package com.phive.validation.api;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import javax.servlet.ServletException;
import javax.servlet.annotation.MultipartConfig;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helger.diver.api.coord.DVRCoordinate;
import com.helger.io.resource.FileSystemResource;
import com.helger.json.IJsonObject;
import com.helger.json.JsonObject;
import com.helger.json.serialize.JsonWriterSettings;
import com.helger.phive.api.execute.ValidationExecutionManager;
import com.helger.phive.api.executorset.IValidationExecutorSet;
import com.helger.phive.api.executorset.ValidationExecutorSetRegistry;
import com.helger.phive.api.result.ValidationResultList;
import com.helger.phive.api.validity.IValidityDeterminator;
import com.helger.phive.result.json.PhiveJsonHelper;
import com.helger.phive.xml.source.IValidationSourceXML;
import com.helger.phive.xml.source.ValidationSourceXML;

/**
 * PHIVE Validation REST API Service
 * 
 * This servlet accepts file uploads and validates them against specified PHIVE rules.
 * 
 * Usage:
 * POST /validate
 * - Form parameter "file": The XML file to validate
 * - Form parameter "rule": The VESID rule identifier (e.g., "eu.peppol.bis3:invoice:2024.11")
 * 
 * Response: JSON validation result
 */
@WebServlet(urlPatterns = { "/validate", "/list-rules", "/api" })
@MultipartConfig(maxFileSize = 100 * 1024 * 1024) // 100MB max file size
public class ValidationService extends HttpServlet
{
  private static final Logger LOGGER = LoggerFactory.getLogger (ValidationService.class);
  
  private static final long serialVersionUID = 1L;
  
  // Thread-safe registry - initialized once
  private static final ValidationExecutorSetRegistry<IValidationSourceXML> VES_REGISTRY = new ValidationExecutorSetRegistry<> ();
  
  // Allowed origins from environment variable (comma-separated)
  private static final String ALLOWED_ORIGINS_ENV = System.getenv ("ALLOWED_ORIGINS");
  private static final String [] ALLOWED_ORIGINS = parseAllowedOrigins (ALLOWED_ORIGINS_ENV);
  
  /**
   * Sort validation classes by dependency order.
   * Critical dependencies:
   * - Simplerinvoicing MUST load before EnergieEFactuur
   * - Core standards (EN16931, UBL, CII) should load first
   * - Peppol base before Peppol variants
   */
  private static java.util.List<String> sortByDependencies(java.util.List<String> classes) {
    java.util.List<String> sorted = new java.util.ArrayList<>();
    
    // Priority order - these load first
    String[] priorityOrder = {
      "EN16931Validation",
      "UBLValidation", 
      "CIIValidation",
      "PeppolValidation",              // Base Peppol first
      "PeppolValidation2024_11",       // Legacy versions after base
      "PeppolItalyValidation",
      "SimplerInvoicingValidation",    // MUST be before EnergieEFactuur
      "EnergieEFactuurValidation"
    };
    
    // Add priority modules first (in order)
    for (String priority : priorityOrder) {
      for (String className : classes) {
        if (className.endsWith(priority)) {
          sorted.add(className);
          break;
        }
      }
    }
    
    // Add remaining modules (alphabetically)
    for (String className : classes) {
      if (!sorted.contains(className)) {
        sorted.add(className);
      }
    }
    
    return sorted;
  }
  
  static
  {
    LOGGER.info ("========================================");
    LOGGER.info ("🚀 Initializing PHIVE Validation Service");
    LOGGER.info ("📦 Auto-loading validation modules from discovered list");
    LOGGER.info ("========================================");
    
    int loadedModules = 0;
    int failedModules = 0;
    
    // Try to load discovered modules first, fallback to hardcoded list
    java.util.List<String> discoveredClasses = new java.util.ArrayList<>();
    final java.io.File discoveryFile = new java.io.File("/app/discovered-modules.txt");
    
    if (discoveryFile.exists()) {
      LOGGER.info ("📄 Loading modules from discovery file: " + discoveryFile.getAbsolutePath());
      try (java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(discoveryFile))) {
        String line;
        while ((line = br.readLine()) != null) {
          line = line.trim();
          if (!line.isEmpty() && line.contains("Validation")) {
            discoveredClasses.add(line);
          }
        }
        LOGGER.info ("✅ Discovered " + discoveredClasses.size() + " validation classes");
        LOGGER.debug ("📋 Discovered classes: " + discoveredClasses);
        
        // CRITICAL: Sort with dependency awareness
        // Simplerinvoicing MUST come before EnergieEFactuur
        // Core modules should load first
        discoveredClasses = sortByDependencies(discoveredClasses);
        LOGGER.info ("🔄 Sorted modules by dependency order");
        LOGGER.debug ("📋 Sorted classes: " + discoveredClasses);
      } catch (Exception e) {
        LOGGER.warn ("⚠ Failed to read discovery file: " + e.getMessage());
      }
    }
    
    // If discovered list doesn't include Peppol Legacy, add it manually
    boolean hasPeppolLegacy = false;
    for (String className : discoveredClasses) {
      if (className.contains("peppol.legacy") || className.contains("PeppolValidation20")) {
        hasPeppolLegacy = true;
        break;
      }
    }
    if (!hasPeppolLegacy) {
      LOGGER.info ("📌 Adding Peppol Legacy manually (not in discovery)");
      discoveredClasses.add("com.helger.phive.peppol.legacy.PeppolValidation2024_11");
    }
    
    // Fallback: Hardcoded list with known working order (for dependencies)
    if (discoveredClasses.isEmpty()) {
      LOGGER.info ("📋 Using fallback hardcoded module list");
      discoveredClasses.add("com.helger.phive.en16931.EN16931Validation");
      discoveredClasses.add("com.helger.phive.peppol.PeppolValidation");
      discoveredClasses.add("com.helger.phive.peppol.legacy.PeppolValidation2024_11");
      discoveredClasses.add("com.helger.phive.peppol.italy.PeppolItalyValidation");
      discoveredClasses.add("com.helger.phive.cii.CIIValidation");
      discoveredClasses.add("com.helger.phive.ubl.UBLValidation");
      discoveredClasses.add("com.helger.phive.ciuspt.CIUS_PTValidation");
      discoveredClasses.add("com.helger.phive.ciusro.CIUS_ROValidation");
      discoveredClasses.add("com.helger.phive.ebinterface.EbInterfaceValidation");
      discoveredClasses.add("com.helger.phive.ehf.EHFValidation");
      discoveredClasses.add("com.helger.phive.simplerinvoicing.SimplerInvoicingValidation");
      discoveredClasses.add("com.helger.phive.energieefactuur.EnergieEFactuurValidation");
      discoveredClasses.add("com.helger.phive.eracun.HReRacunValidation");
      discoveredClasses.add("com.helger.phive.facturae.FacturaeValidation");
      discoveredClasses.add("com.helger.phive.fatturapa.FatturaPAValidation");
      discoveredClasses.add("com.helger.phive.finvoice.FinvoiceValidation");
      discoveredClasses.add("com.helger.phive.france.FranceCTCValidation");
      discoveredClasses.add("com.helger.phive.isdoc.ISDOCValidation");
      discoveredClasses.add("com.helger.phive.ksef.KSeFValidation");
      discoveredClasses.add("com.helger.phive.oioubl.OIOUBLValidation");
      discoveredClasses.add("com.helger.phive.setu.SETUValidation");
      discoveredClasses.add("com.helger.phive.svefaktura.SvefakturaValidation");
      discoveredClasses.add("com.helger.phive.teapps.TEAPPSValidation");
      discoveredClasses.add("com.helger.phive.ublbe.UBLBEValidation");
      discoveredClasses.add("com.helger.phive.xrechnung.XRechnungValidation");
      discoveredClasses.add("com.helger.phive.zatca.ZATCAValidation");
      discoveredClasses.add("com.helger.phive.zugferd.ZugferdValidation");
    }
    
    // Try to load each discovered module dynamically
    for (final String className : discoveredClasses)
    {
      // Extract display name from class name
      final String displayName = className.substring(className.lastIndexOf('.') + 1).replace("Validation", "");
      
      try
      {
        // Try to load the class dynamically
        final Class<?> clazz = Class.forName (className);
        final java.lang.reflect.Method[] methods = clazz.getMethods ();
        
        boolean methodInvoked = false;
        for (final java.lang.reflect.Method method : methods)
        {
          if (method.getName ().startsWith ("init") && 
              method.getParameterCount () == 1 &&
              java.lang.reflect.Modifier.isStatic (method.getModifiers ()))
          {
            method.invoke (null, VES_REGISTRY);
            LOGGER.info ("✓ " + displayName);
            loadedModules++;
            methodInvoked = true;
            break;
          }
        }
        
        if (!methodInvoked)
        {
          LOGGER.warn ("⚠ " + displayName + " - No suitable init method found");
          failedModules++;
        }
      }
      catch (final ClassNotFoundException ex)
      {
        LOGGER.warn ("⚠ " + displayName + " - Module not available in build");
        failedModules++;
      }
      catch (final java.lang.reflect.InvocationTargetException ex)
      {
        final Throwable cause = ex.getCause();
        final String errorMsg = cause != null ? cause.getMessage() : ex.getMessage();
        LOGGER.warn ("⚠ " + displayName + " - Failed to initialize: " + errorMsg);
        if (cause != null) {
          LOGGER.debug ("   Root cause: " + cause.getClass().getName());
        }
        failedModules++;
      }
      catch (final Exception ex)
      {
        LOGGER.warn ("⚠ " + displayName + " - Failed to load: " + ex.getClass().getSimpleName() + ": " + ex.getMessage());
        failedModules++;
      }
    }
    
    final int totalRules = VES_REGISTRY.getAll ().size ();
    LOGGER.info ("========================================");
    LOGGER.info ("✅ PHIVE Validation Service initialized!");
    LOGGER.info ("📊 Statistics:");
    LOGGER.info ("   Modules discovered: " + discoveredClasses.size());
    LOGGER.info ("   Modules loaded: " + loadedModules);
    LOGGER.info ("   Modules skipped: " + failedModules);
    LOGGER.info ("   Total validation rulesets: " + totalRules);
    LOGGER.info ("========================================");
    
    if (ALLOWED_ORIGINS_ENV != null && !ALLOWED_ORIGINS_ENV.isEmpty ())
    {
      LOGGER.info ("CORS: Allowed origins configured: " + ALLOWED_ORIGINS_ENV);
    }
    else
    {
      LOGGER.info ("CORS: No ALLOWED_ORIGINS environment variable set, allowing all origins (*)");
    }
  }
  
  /**
   * Parse allowed origins from environment variable
   * Format: "https://domain1.com,https://domain2.com,https://domain3.com"
   */
  private static String [] parseAllowedOrigins (final String envValue)
  {
    if (envValue == null || envValue.trim ().isEmpty ())
    {
      return null; // Allow all origins
    }
    
    final String [] origins = envValue.split (",");
    // Trim whitespace from each origin
    for (int i = 0; i < origins.length; i++)
    {
      origins[i] = origins[i].trim ();
    }
    return origins;
  }
  
  /**
   * Set CORS headers based on allowed origins
   */
  private void setCorsHeaders (final HttpServletRequest request, final HttpServletResponse response)
  {
    final String origin = request.getHeader ("Origin");
    
    // If no allowed origins configured, allow all
    if (ALLOWED_ORIGINS == null)
    {
      response.setHeader ("Access-Control-Allow-Origin", "*");
    }
    else
    {
      // Check if origin is in allowed list
      boolean isAllowed = false;
      if (origin != null && !origin.isEmpty ())
      {
        for (final String allowedOrigin : ALLOWED_ORIGINS)
        {
          if (origin.equals (allowedOrigin.trim ()))
          {
            isAllowed = true;
            break;
          }
        }
      }
      
      if (isAllowed)
      {
        response.setHeader ("Access-Control-Allow-Origin", origin);
        response.setHeader ("Access-Control-Allow-Credentials", "true");
      }
      // If origin not allowed, don't set CORS headers (browser will block)
    }
    
    // Set other CORS headers
    response.setHeader ("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader ("Access-Control-Allow-Headers", "Content-Type, Accept, Origin, X-Requested-With");
    response.setHeader ("Access-Control-Max-Age", "3600");
  }
  
  @Override
  protected void doOptions (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    // Handle preflight requests
    setCorsHeaders (request, response);
    response.setStatus (HttpServletResponse.SC_OK);
  }
  
  @Override
  protected void doPost (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    // Set CORS headers
    setCorsHeaders (request, response);
    
    response.setContentType ("application/json");
    response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
    
    final long nStartTime = System.nanoTime ();
    final IJsonObject aResponse = new JsonObject ();
    
    try
    {
      // Get rule parameter
      final String sRule = request.getParameter ("rule");
      if (sRule == null || sRule.trim ().isEmpty ())
      {
        PhiveJsonHelper.applyGlobalError (aResponse,
                                         "Missing required parameter 'rule'. Please specify a VESID (e.g., 'eu.peppol.bis3:invoice:2024.11')",
                                         TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime));
        sendResponse (response, aResponse);
        return;
      }
      
      // Parse VESID
      final DVRCoordinate aVESID = DVRCoordinate.parseOrNull (sRule);
      if (aVESID == null)
      {
        PhiveJsonHelper.applyGlobalError (aResponse,
                                         "Invalid rule format: '" +
                                                          sRule +
                                                          "'. Expected format: 'groupId:artifactId:version' (e.g., 'eu.peppol.bis3:invoice:2024.11')",
                                         TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime));
        sendResponse (response, aResponse);
        return;
      }
      
      // Get validation executor set
      final IValidationExecutorSet<IValidationSourceXML> aExecutors = VES_REGISTRY.getOfID (aVESID);
      if (aExecutors == null)
      {
        PhiveJsonHelper.applyGlobalError (aResponse,
                                         "Rule not found: '" +
                                                          sRule +
                                                          "'. Available rules can be queried via /list-rules endpoint.",
                                         TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime));
        sendResponse (response, aResponse);
        return;
      }
      
      // Get uploaded file
      final javax.servlet.http.Part filePart = request.getPart ("file");
      if (filePart == null || filePart.getSize () == 0)
      {
        PhiveJsonHelper.applyGlobalError (aResponse,
                                         "Missing required parameter 'file'. Please upload an XML file to validate.",
                                         TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime));
        sendResponse (response, aResponse);
        return;
      }
      
      // Save uploaded file temporarily
      File tempFile = null;
      try
      {
        tempFile = File.createTempFile ("phive-validation-", ".xml");
        tempFile.deleteOnExit ();
        
        try (InputStream input = filePart.getInputStream (); OutputStream output = new FileOutputStream (tempFile))
        {
          final byte[] buffer = new byte[8192];
          int bytesRead;
          while ((bytesRead = input.read (buffer)) != -1)
          {
            output.write (buffer, 0, bytesRead);
          }
        }
        
        LOGGER.info ("Validating file: " + filePart.getSubmittedFileName () + " against rule: " + sRule);
        
        // Create validation source
        final IValidationSourceXML aSource = ValidationSourceXML.create (new FileSystemResource (tempFile));
        
        // Execute validation with stop-on-error strategy
        // If XML Schema validation fails, skip Schematron validations
        final ValidationResultList aValidationResults = ValidationExecutionManager.executeValidation (
            IValidityDeterminator.createDefault (),
            aExecutors,
            aSource,
            Locale.US);
        
        // Convert to JSON using PHIVE's standard format
        final long nDurationMS = TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime);
        new com.helger.phive.result.json.JsonValidationResultListHelper ()
            .sourceToJson (null) // Don't include validation source (which contains payload)
            .ves (aExecutors)
            .applyTo (aResponse, aValidationResults, Locale.US, nDurationMS);
        
        // Post-process: Add "skipped" status to Schematron validations if XML Schema failed
        markSkippedValidations (aResponse, aValidationResults);
        
        // Override success field to use containsNoError for better accuracy
        aResponse.add (PhiveJsonHelper.JSON_SUCCESS, aValidationResults.containsNoError ());
        
        // Add file name to response (handle paste content case)
        final String sFileName = filePart.getSubmittedFileName ();
        aResponse.add ("fileName", sFileName != null && !sFileName.isEmpty () ? sFileName : "pasted-content.xml");
        aResponse.add ("rule", sRule);
        
        LOGGER.info ("Validation completed in " + nDurationMS + "ms. Success: " + aValidationResults.containsNoError ());
      }
      finally
      {
        // Clean up temp file
        if (tempFile != null && tempFile.exists ())
        {
          tempFile.delete ();
        }
      }
    }
    catch (final Exception ex)
    {
      LOGGER.error ("Error during validation", ex);
      final long nDurationMS = TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime);
      PhiveJsonHelper.applyGlobalError (aResponse,
                                       "Internal error: " + ex.getMessage (),
                                       nDurationMS);
    }
    
    sendResponse (response, aResponse);
  }
  
  @Override
  protected void doGet (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    final String requestURI = request.getRequestURI ();
    final String contextPath = request.getContextPath ();
    final String pathInfo = requestURI.substring (contextPath.length ());
    
    // Don't handle root path - let Tomcat serve static files (index.html)
    if (pathInfo == null || pathInfo.isEmpty () || pathInfo.equals ("/") || pathInfo.equals (""))
    {
      // Forward to default servlet to serve static files
      request.getRequestDispatcher ("/index.html").forward (request, response);
      return;
    }
    
    // Handle /list-rules endpoint
    if (pathInfo.equals ("/list-rules") || pathInfo.endsWith ("/list-rules"))
    {
      // Set CORS headers
      setCorsHeaders (request, response);
      
      // List all available rules
      response.setContentType ("application/json");
      response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
      
      final IJsonObject aResponse = new JsonObject ();
      final com.helger.json.IJsonArray aRules = new com.helger.json.JsonArray ();
      
      for (final IValidationExecutorSet<IValidationSourceXML> aVES : VES_REGISTRY.getAll ())
      {
        final IJsonObject aRule = new JsonObject ();
        final String sVESID = aVES.getID ().getAsSingleID ();
        aRule.add ("vesid", sVESID);
        aRule.add ("name", aVES.getDisplayName ());
        // Create a more readable name from VESID
        aRule.add ("readableName", createReadableRuleName (sVESID, aVES.getDisplayName ()));
        if (aVES.getStatus ().isDeprecated ())
        {
          aRule.add ("deprecated", true);
        }
        aRules.add (aRule);
      }
      
      aResponse.add ("rules", aRules);
      aResponse.add ("count", aRules.size ());
      
      sendResponse (response, aResponse);
    }
    else if (pathInfo.equals ("/api") || pathInfo.endsWith ("/api"))
    {
      // Set CORS headers
      setCorsHeaders (request, response);
      
      // Health check or info
      response.setContentType ("application/json");
      response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
      
      final IJsonObject aResponse = new JsonObject ();
      aResponse.add ("service", "PHIVE Validation API");
      aResponse.add ("version", "1.2.0");
      aResponse.add ("status", "running");
      aResponse.add ("buildType", "Local phive-rules (ALL 27 MODULES)");
      aResponse.add ("availableRules", VES_REGISTRY.getAll ().size ());
      aResponse.add ("standards", "All phive-rules modules: EN16931, Peppol, UBL, CII, XRechnung, ZUGFeRD, fatturaPA, OIOUBL, EHF, ebInterface, and 17 more...");
      
      sendResponse (response, aResponse);
    }
    else
    {
      // Unknown endpoint - let default servlet handle it (might be a static file)
      // Don't send 404, let Tomcat handle it
      return;
    }
  }
  
  /**
   * Post-process validation results to mark Schematron validations as "skipped"
   * if XML Schema validation failed.
   * 
   * This modifies the JSON response in-place by adding "skipped" field to each validation result.
   */
  private void markSkippedValidations (final IJsonObject aResponse, final ValidationResultList aValidationResults)
  {
    // Check if XML Schema (XSD) validation failed by checking if first validation has errors
    boolean xmlSchemaFailed = false;
    if (aValidationResults.size () > 0)
    {
      final var firstResult = aValidationResults.get (0);
      // If first validation has errors, consider XSD failed
      if (firstResult.getErrorList () != null && !firstResult.getErrorList ().isEmpty ())
      {
        xmlSchemaFailed = true;
        LOGGER.info ("XML Schema validation failed - marking subsequent Schematron validations as SKIPPED");
      }
    }
    
    // If XSD failed, add "skipped" field to all Schematron validations in the JSON response
    if (xmlSchemaFailed && aResponse.containsKey ("results"))
    {
      final com.helger.json.IJsonArray aResults = aResponse.getAsArray ("results");
      if (aResults != null)
      {
        boolean isFirst = true;
        for (final com.helger.json.IJson aResultItem : aResults)
        {
          if (aResultItem != null && aResultItem.isObject ())
          {
            final IJsonObject aResultObj = aResultItem.getAsObject ();
            if (!isFirst)
            {
              // Mark all subsequent validations (Schematron) as skipped
              aResultObj.add ("skipped", true);
              aResultObj.add ("skipReason", "XML Schema validation failed - Schematron validation not executed");
            }
            else
            {
              // First one (XSD) is not skipped
              aResultObj.add ("skipped", false);
            }
            isFirst = false;
          }
        }
      }
    }
    else if (aResponse.containsKey ("results"))
    {
      // XSD passed, mark all as not skipped
      final com.helger.json.IJsonArray aResults = aResponse.getAsArray ("results");
      if (aResults != null)
      {
        for (final com.helger.json.IJson aResultItem : aResults)
        {
          if (aResultItem != null && aResultItem.isObject ())
          {
            final IJsonObject aResultObj = aResultItem.getAsObject ();
            aResultObj.add ("skipped", false);
          }
        }
      }
    }
  }
  
  /**
   * Create a more readable rule name from VESID
   * Example: "eu.peppol.bis3:invoice:2024.11" -> "Peppol BIS 3 Invoice 2024.11"
   */
  private String createReadableRuleName (final String sVESID, final String sDisplayName)
  {
    if (sVESID == null || sVESID.isEmpty ())
      return sDisplayName != null ? sDisplayName : "Unknown Rule";
    
    try
    {
      final String [] parts = sVESID.split (":");
      if (parts.length >= 3)
      {
        final String groupId = parts[0];
        final String artifactId = parts[1];
        final String version = parts[2];
        
        // Convert groupId to readable format
        String readableGroup = groupId;
        if (groupId.startsWith ("eu.peppol"))
        {
          readableGroup = "Peppol";
          // Extract BIS version if present
          if (groupId.contains ("bis3"))
            readableGroup += " BIS 3";
          else if (groupId.contains ("bis2"))
            readableGroup += " BIS 2";
          else if (groupId.contains ("bis"))
            readableGroup += " BIS";
        }
        else if (groupId.startsWith ("com.helger.phive"))
        {
          readableGroup = "PHIVE";
        }
        else
        {
          // Capitalize first letter of each word
          readableGroup = groupId.replaceAll ("\\.", " ");
          readableGroup = capitalizeWords (readableGroup);
        }
        
        // Convert artifactId to readable format
        String readableArtifact = capitalizeWords (artifactId.replaceAll ("-", " ").replaceAll ("_", " "));
        
        // Combine
        return readableGroup + " " + readableArtifact + " " + version;
      }
    }
    catch (final Exception ex)
    {
      LOGGER.warn ("Failed to create readable name for VESID: " + sVESID, ex);
    }
    
    // Fallback to display name or VESID
    return sDisplayName != null && !sDisplayName.isEmpty () ? sDisplayName : sVESID;
  }
  
  /**
   * Capitalize first letter of each word
   */
  private String capitalizeWords (final String s)
  {
    if (s == null || s.isEmpty ())
      return s;
    
    final StringBuilder sb = new StringBuilder ();
    final String [] words = s.split ("\\s+");
    for (int i = 0; i < words.length; i++)
    {
      if (i > 0)
        sb.append (" ");
      if (!words[i].isEmpty ())
      {
        sb.append (Character.toUpperCase (words[i].charAt (0)));
        if (words[i].length () > 1)
          sb.append (words[i].substring (1).toLowerCase ());
      }
    }
    return sb.toString ();
  }
  
  private void sendResponse (final HttpServletResponse response, final IJsonObject aResponse) throws IOException
  {
    try (PrintWriter writer = response.getWriter ())
    {
      // Format JSON with indentation for readability
      writer.print (aResponse.getAsJsonString (JsonWriterSettings.DEFAULT_SETTINGS_FORMATTED));
      writer.flush ();
    }
  }
}


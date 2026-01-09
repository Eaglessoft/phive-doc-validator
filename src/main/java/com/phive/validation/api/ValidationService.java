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
import com.helger.phive.en16931.EN16931Validation;
import com.helger.phive.peppol.PeppolValidation;
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
  
  static
  {
    // Initialize EN 16931 validation rules first (required for Peppol)
    EN16931Validation.initEN16931 (VES_REGISTRY);
    
    // Initialize all Peppol validation rules
    PeppolValidation.initStandard (VES_REGISTRY);
    LOGGER.info ("PHIVE Validation Service initialized with " + VES_REGISTRY.getAll ().size () + " validation rule sets");
    
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
        
        // Execute validation
        final ValidationResultList aValidationResults = ValidationExecutionManager.executeValidation (IValidityDeterminator.createDefault (),
                                                                                                     aExecutors,
                                                                                                     aSource,
                                                                                                     Locale.US);
        
        // Convert to JSON (without payload)
        final long nDurationMS = TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - nStartTime);
        new com.helger.phive.result.json.JsonValidationResultListHelper ()
            .sourceToJson (null) // Don't include validation source (which contains payload)
            .ves (aExecutors)
            .applyTo (aResponse, aValidationResults, Locale.US, nDurationMS);
        
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
      aResponse.add ("version", "1.0.0");
      aResponse.add ("status", "running");
      aResponse.add ("availableRules", VES_REGISTRY.getAll ().size ());
      
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


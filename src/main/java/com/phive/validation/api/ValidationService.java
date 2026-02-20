package com.phive.validation.api;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.helger.json.IJsonObject;
import com.helger.json.JsonObject;
import com.helger.json.serialize.JsonWriterSettings;
import com.helger.phive.api.executorset.ValidationExecutorSetRegistry;
import com.helger.phive.result.json.PhiveJsonHelper;
import com.helger.phive.xml.source.IValidationSourceXML;

/**
 * PHIVE Validation REST API Service
 */
@WebServlet(urlPatterns = { "/validate", "/list-rules", "/api" })
@MultipartConfig(maxFileSize = 100 * 1024 * 1024) // 100MB max file size
public class ValidationService extends HttpServlet
{
  private static final Logger LOGGER = LoggerFactory.getLogger (ValidationService.class);

  private static final long serialVersionUID = 1L;

  private static final String PATH_LIST_RULES = "/list-rules";
  private static final String PATH_API = "/api";

  private static final String ALLOWED_ORIGINS_ENV = System.getenv ("ALLOWED_ORIGINS");
  private static final Set<String> ALLOWED_ORIGIN_SET = parseAllowedOrigins (ALLOWED_ORIGINS_ENV);
  private static final boolean JSON_PRETTY_PRINT = parseBooleanEnv ("JSON_PRETTY_PRINT", false);

  private static final ValidationExecutorSetRegistry<IValidationSourceXML> VES_REGISTRY = new ValidationExecutorSetRegistry<> ();
  private static final String LIST_RULES_RESPONSE_JSON;

  static
  {
    ValidationModuleBootstrap.initialize (VES_REGISTRY, LOGGER);
    logCorsConfiguration ();
    LIST_RULES_RESPONSE_JSON = new RuleResponseBuilder ().buildRulesResponseJson (VES_REGISTRY, JSON_PRETTY_PRINT);
  }

  private final ValidationRequestHandler validationRequestHandler = new ValidationRequestHandler (VES_REGISTRY, LOGGER);
  private final RuleResponseBuilder ruleResponseBuilder = new RuleResponseBuilder ();

  private static void logCorsConfiguration ()
  {
    if (ALLOWED_ORIGINS_ENV != null && !ALLOWED_ORIGINS_ENV.isEmpty ())
    {
      LOGGER.info ("CORS: Allowed origins configured.");
      LOGGER.debug ("CORS allowed origins: " + ALLOWED_ORIGINS_ENV);
    }
    else
      LOGGER.info ("CORS: No ALLOWED_ORIGINS environment variable set, allowing all origins (*)");
  }

  private static Set<String> parseAllowedOrigins (final String envValue)
  {
    if (envValue == null || envValue.trim ().isEmpty ())
      return null;

    final String [] origins = envValue.split (",");
    final Set<String> ret = new LinkedHashSet<> ();
    for (int i = 0; i < origins.length; i++)
    {
      final String origin = origins[i].trim ();
      if (!origin.isEmpty ())
        ret.add (origin);
    }
    return ret.isEmpty () ? null : Collections.unmodifiableSet (ret);
  }

  private static boolean parseBooleanEnv (final String envName, final boolean defaultValue)
  {
    final String rawValue = System.getenv (envName);
    if (rawValue == null)
      return defaultValue;
    return "true".equalsIgnoreCase (rawValue.trim ()) || "1".equals (rawValue.trim ());
  }

  private void setCorsHeaders (final HttpServletRequest request, final HttpServletResponse response)
  {
    final String origin = request.getHeader ("Origin");

    if (ALLOWED_ORIGIN_SET == null)
    {
      response.setHeader ("Access-Control-Allow-Origin", "*");
    }
    else
    {
      addVaryHeader (response, "Origin");
      if (origin != null && ALLOWED_ORIGIN_SET.contains (origin))
      {
        response.setHeader ("Access-Control-Allow-Origin", origin);
        response.setHeader ("Access-Control-Allow-Credentials", "true");
      }
    }

    response.setHeader ("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader ("Access-Control-Allow-Headers", "Content-Type, Accept, Origin, X-Requested-With");
    response.setHeader ("Access-Control-Max-Age", "3600");
  }

  @Override
  protected void doOptions (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    setCorsHeaders (request, response);
    response.setStatus (HttpServletResponse.SC_OK);
  }

  @Override
  protected void doPost (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    setCorsHeaders (request, response);
    response.setContentType ("application/json");
    response.setCharacterEncoding (StandardCharsets.UTF_8.name ());

    final long startTime = System.nanoTime ();
    final IJsonObject jsonResponse = new JsonObject ();

    try
    {
      validationRequestHandler.handleValidationRequest (request, jsonResponse, startTime);
    }
    catch (final Exception ex)
    {
      LOGGER.error ("Error during validation", ex);
      final long durationMS = TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - startTime);
      PhiveJsonHelper.applyGlobalError (jsonResponse, "Internal error occurred while processing validation request.", durationMS);
    }

    sendResponse (response, jsonResponse);
  }

  @Override
  protected void doGet (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    final String pathInfo = getPathInfo (request);

    if (matchesPath (pathInfo, PATH_LIST_RULES))
    {
      setCorsHeaders (request, response);
      response.setContentType ("application/json");
      response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
      sendRawResponse (response, LIST_RULES_RESPONSE_JSON);
      return;
    }

    if (matchesPath (pathInfo, PATH_API))
    {
      setCorsHeaders (request, response);
      response.setContentType ("application/json");
      response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
      sendResponse (response, ruleResponseBuilder.buildApiInfoResponse (VES_REGISTRY));
      return;
    }

    response.sendError (HttpServletResponse.SC_NOT_FOUND);
  }

  private static String getPathInfo (final HttpServletRequest request)
  {
    final String requestURI = request.getRequestURI ();
    final String contextPath = request.getContextPath ();
    return requestURI.substring (contextPath.length ());
  }

  private static boolean matchesPath (final String pathInfo, final String target)
  {
    return target.equals (pathInfo) || (pathInfo != null && pathInfo.endsWith (target));
  }

  private void sendResponse (final HttpServletResponse response, final IJsonObject jsonResponse) throws IOException
  {
    try (PrintWriter writer = response.getWriter ())
    {
      if (!JSON_PRETTY_PRINT)
        writer.print (jsonResponse.getAsJsonString (JsonWriterSettings.DEFAULT_SETTINGS));
      else
        writer.print (jsonResponse.getAsJsonString (JsonWriterSettings.DEFAULT_SETTINGS_FORMATTED));
      writer.flush ();
    }
  }

  private void sendRawResponse (final HttpServletResponse response, final String responseBody) throws IOException
  {
    try (PrintWriter writer = response.getWriter ())
    {
      writer.print (responseBody);
      writer.flush ();
    }
  }

  private static void addVaryHeader (final HttpServletResponse response, final String varyValue)
  {
    final String existing = response.getHeader ("Vary");
    if (existing == null || existing.isBlank ())
    {
      response.setHeader ("Vary", varyValue);
      return;
    }
    if (!existing.contains (varyValue))
      response.setHeader ("Vary", existing + ", " + varyValue);
  }
}

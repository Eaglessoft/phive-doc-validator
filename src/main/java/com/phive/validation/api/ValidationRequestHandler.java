package com.phive.validation.api;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.Part;

import org.slf4j.Logger;

import com.helger.diver.api.coord.DVRCoordinate;
import com.helger.io.resource.FileSystemResource;
import com.helger.json.IJson;
import com.helger.json.IJsonArray;
import com.helger.json.IJsonObject;
import com.helger.phive.api.execute.ValidationExecutionManager;
import com.helger.phive.api.executorset.IValidationExecutorSet;
import com.helger.phive.api.executorset.ValidationExecutorSetRegistry;
import com.helger.phive.api.result.ValidationResultList;
import com.helger.phive.api.validity.IValidityDeterminator;
import com.helger.phive.result.json.JsonValidationResultListHelper;
import com.helger.phive.result.json.PhiveJsonHelper;
import com.helger.phive.xml.source.IValidationSourceXML;
import com.helger.phive.xml.source.ValidationSourceXML;

final class ValidationRequestHandler
{
  private static final String PARAM_RULE = "rule";
  private static final String PARAM_FILE = "file";

  private final ValidationExecutorSetRegistry<IValidationSourceXML> registry;
  private final Logger logger;

  ValidationRequestHandler (final ValidationExecutorSetRegistry<IValidationSourceXML> registry, final Logger logger)
  {
    this.registry = registry;
    this.logger = logger;
  }

  void handleValidationRequest (final HttpServletRequest request,
                                final IJsonObject response,
                                final long startTime) throws Exception
  {
    final String rule = request.getParameter (PARAM_RULE);
    if (rule == null || rule.trim ().isEmpty ())
    {
      applyValidationError (response,
                            "Missing required parameter 'rule'. Please specify a VESID (e.g., 'eu.peppol.bis3:invoice:2024.11')",
                            startTime);
      return;
    }

    final DVRCoordinate vesid = DVRCoordinate.parseOrNull (rule);
    if (vesid == null)
    {
      applyValidationError (response,
                            "Invalid rule format: '" + rule +
                                      "'. Expected format: 'groupId:artifactId:version' (e.g., 'eu.peppol.bis3:invoice:2024.11')",
                            startTime);
      return;
    }

    final IValidationExecutorSet<IValidationSourceXML> executors = registry.getOfID (vesid);
    if (executors == null)
    {
      applyValidationError (response,
                            "Rule not found: '" + rule + "'. Available rules can be queried via /list-rules endpoint.",
                            startTime);
      return;
    }

    final Part filePart = request.getPart (PARAM_FILE);
    if (filePart == null || filePart.getSize () == 0)
    {
      applyValidationError (response,
                            "Missing required parameter 'file'. Please upload an XML file to validate.",
                            startTime);
      return;
    }

    executeValidation (response, startTime, rule, executors, filePart);
  }

  private void executeValidation (final IJsonObject response,
                                  final long startTime,
                                  final String rule,
                                  final IValidationExecutorSet<IValidationSourceXML> executors,
                                  final Part filePart) throws Exception
  {
    File tempFile = null;
    try
    {
      tempFile = saveUploadedPartToTempFile (filePart);
      logger.debug ("Validating file: " + filePart.getSubmittedFileName () + " against rule: " + rule);

      final IValidationSourceXML source = ValidationSourceXML.create (new FileSystemResource (tempFile));
      final Locale locale = Objects.requireNonNull (Locale.US);

      final ValidationResultList validationResults = ValidationExecutionManager.executeValidation (IValidityDeterminator.createDefault (),
                                                                                                    executors,
                                                                                                    source,
                                                                                                    locale);

      final long durationMS = elapsedMs (startTime);
      new JsonValidationResultListHelper ().sourceToJson (null).ves (executors).applyTo (response, validationResults, locale, durationMS);

      markSkippedValidations (response, validationResults);

      response.add (PhiveJsonHelper.JSON_SUCCESS, validationResults.containsNoError ());
      final String fileName = filePart.getSubmittedFileName ();
      response.add ("fileName", fileName != null && !fileName.isEmpty () ? fileName : "pasted-content.xml");
      response.add ("rule", rule);

      logger.debug ("Validation completed in " + durationMS + "ms. Success: " + validationResults.containsNoError ());
    }
    finally
    {
      deleteTempFile (tempFile);
    }
  }

  private void markSkippedValidations (final IJsonObject response, final ValidationResultList validationResults)
  {
    final IJsonArray results = response.getAsArray ("results");
    if (results == null)
      return;

    final boolean xmlSchemaFailed = hasXmlSchemaFailed (validationResults);
    if (xmlSchemaFailed)
      logger.debug ("XML Schema validation failed - marking subsequent Schematron validations as SKIPPED");

    boolean isFirst = true;
    for (final IJson resultItem : results)
    {
      if (resultItem == null || !resultItem.isObject ())
        continue;

      final IJsonObject resultObj = resultItem.getAsObject ();
      if (resultObj == null)
        continue;

      if (xmlSchemaFailed && !isFirst)
      {
        resultObj.add ("skipped", true);
        resultObj.add ("skipReason", "XML Schema validation failed - Schematron validation not executed");
      }
      else
      {
        resultObj.add ("skipped", false);
      }

      isFirst = false;
    }
  }

  private static boolean hasXmlSchemaFailed (final ValidationResultList validationResults)
  {
    if (validationResults.isEmpty ())
      return false;

    final var firstResult = validationResults.get (0);
    return firstResult.getErrorList () != null && !firstResult.getErrorList ().isEmpty ();
  }

  private static File saveUploadedPartToTempFile (final Part filePart) throws IOException
  {
    final File tempFile = File.createTempFile ("phive-validation-", ".xml");
    try (InputStream input = filePart.getInputStream (); OutputStream output = new FileOutputStream (tempFile))
    {
      final byte [] buffer = new byte [8192];
      int bytesRead;
      while ((bytesRead = input.read (buffer)) != -1)
        output.write (buffer, 0, bytesRead);
    }
    return tempFile;
  }

  private static void deleteTempFile (final File tempFile)
  {
    if (tempFile != null && tempFile.exists ())
      tempFile.delete ();
  }

  private static void applyValidationError (final IJsonObject response, final String message, final long startTime)
  {
    PhiveJsonHelper.applyGlobalError (response, message, elapsedMs (startTime));
  }

  private static long elapsedMs (final long startTime)
  {
    return TimeUnit.NANOSECONDS.toMillis (System.nanoTime () - startTime);
  }
}

package com.phive.validation.api;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;

import com.helger.phive.api.executorset.ValidationExecutorSetRegistry;
import com.helger.phive.xml.source.IValidationSourceXML;

final class ValidationModuleBootstrap
{
  private ValidationModuleBootstrap ()
  {}

  static void initialize (final ValidationExecutorSetRegistry<IValidationSourceXML> registry, final Logger logger)
  {
    logger.debug ("========================================");
    logger.debug ("Initializing PHIVE Validation Service");
    logger.debug ("Auto-loading validation modules from discovered list");
    logger.debug ("========================================");

    final List<String> moduleClassNames = buildModuleClassNames (logger);
    final ModuleLoadStats stats = loadModules (registry, logger, moduleClassNames);

    logger.info ("PHIVE Validation Service initialized.");
    logger.info ("Initialization statistics:");
    logger.info ("   Modules discovered: " + moduleClassNames.size ());
    logger.info ("   Modules loaded: " + stats.loadedModules);
    logger.info ("   Modules skipped: " + stats.failedModules);
    logger.info ("   Total validation rulesets: " + registry.getAll ().size ());
    logger.debug ("========================================");
  }

  private static List<String> buildModuleClassNames (final Logger logger)
  {
    logger.debug ("Using static module list");
    final List<String> discoveredClasses = getFallbackModuleClassNames ();

    ensurePeppolLegacyPresent (logger, discoveredClasses);

    final List<String> ordered = sortByDependencies (discoveredClasses);
    final Set<String> uniqueOrdered = new LinkedHashSet<> (ordered);
    return new ArrayList<> (uniqueOrdered);
  }

  private static List<String> sortByDependencies (final List<String> classes)
  {
    final List<String> sorted = new ArrayList<> ();

    final String [] priorityOrder = {
                                "EN16931Validation",
                                "UBLValidation",
                                "CIIValidation",
                                "PeppolValidation",
                                "PeppolValidation2024_11",
                                "PeppolItalyValidation",
                                "SimplerInvoicingValidation",
                                "EnergieEFactuurValidation"
    };

    for (final String priority : priorityOrder)
    {
      for (final String className : classes)
      {
        if (className.endsWith (priority))
        {
          sorted.add (className);
          break;
        }
      }
    }

    for (final String className : classes)
      if (!sorted.contains (className))
        sorted.add (className);

    return sorted;
  }

  private static List<String> getFallbackModuleClassNames ()
  {
    final List<String> classes = new ArrayList<> ();
    classes.add ("com.helger.phive.en16931.EN16931Validation");
    classes.add ("com.helger.phive.peppol.PeppolValidation");
    classes.add ("com.helger.phive.peppol.legacy.PeppolValidation2024_11");
    classes.add ("com.helger.phive.peppol.italy.PeppolItalyValidation");
    classes.add ("com.helger.phive.cii.CIIValidation");
    classes.add ("com.helger.phive.ubl.UBLValidation");
    classes.add ("com.helger.phive.ciuspt.CIUS_PTValidation");
    classes.add ("com.helger.phive.ciusro.CIUS_ROValidation");
    classes.add ("com.helger.phive.ebinterface.EbInterfaceValidation");
    classes.add ("com.helger.phive.ehf.EHFValidation");
    classes.add ("com.helger.phive.simplerinvoicing.SimplerInvoicingValidation");
    classes.add ("com.helger.phive.energieefactuur.EnergieEFactuurValidation");
    classes.add ("com.helger.phive.eracun.HReRacunValidation");
    classes.add ("com.helger.phive.facturae.FacturaeValidation");
    classes.add ("com.helger.phive.fatturapa.FatturaPAValidation");
    classes.add ("com.helger.phive.finvoice.FinvoiceValidation");
    classes.add ("com.helger.phive.france.FranceCTCValidation");
    classes.add ("com.helger.phive.isdoc.ISDOCValidation");
    classes.add ("com.helger.phive.ksef.KSeFValidation");
    classes.add ("com.helger.phive.oioubl.OIOUBLValidation");
    classes.add ("com.helger.phive.setu.SETUValidation");
    classes.add ("com.helger.phive.svefaktura.SvefakturaValidation");
    classes.add ("com.helger.phive.teapps.TEAPPSValidation");
    classes.add ("com.helger.phive.ublbe.UBLBEValidation");
    classes.add ("com.helger.phive.xrechnung.XRechnungValidation");
    classes.add ("com.helger.phive.zatca.ZATCAValidation");
    classes.add ("com.helger.phive.zugferd.ZugferdValidation");
    return classes;
  }

  private static void ensurePeppolLegacyPresent (final Logger logger, final List<String> classes)
  {
    boolean hasPeppolLegacy = false;
    for (final String className : classes)
      if (className.contains ("peppol.legacy") || className.contains ("PeppolValidation20"))
      {
        hasPeppolLegacy = true;
        break;
      }

    if (!hasPeppolLegacy)
    {
      logger.debug ("Adding Peppol Legacy manually (not in discovery)");
      classes.add ("com.helger.phive.peppol.legacy.PeppolValidation2024_11");
    }
  }

  private static ModuleLoadStats loadModules (final ValidationExecutorSetRegistry<IValidationSourceXML> registry,
                                               final Logger logger,
                                               final List<String> moduleClassNames)
  {
    int loadedModules = 0;
    int failedModules = 0;

    for (final String className : moduleClassNames)
      if (tryLoadModule (registry, logger, className))
        loadedModules++;
      else
        failedModules++;

    return new ModuleLoadStats (loadedModules, failedModules);
  }

  private static boolean tryLoadModule (final ValidationExecutorSetRegistry<IValidationSourceXML> registry,
                                        final Logger logger,
                                        final String className)
  {
    final String displayName = className.substring (className.lastIndexOf ('.') + 1).replace ("Validation", "");

    try
    {
      final Class<?> clazz = Class.forName (className);
      final java.lang.reflect.Method [] methods = clazz.getMethods ();

      for (final java.lang.reflect.Method method : methods)
      {
        if (method.getName ().startsWith ("init") && method.getParameterCount () == 1 &&
            java.lang.reflect.Modifier.isStatic (method.getModifiers ()))
        {
          method.invoke (null, registry);
          logger.debug ("Loaded module: " + displayName);
          return true;
        }
      }

      logger.warn ("⚠ " + displayName + " - No suitable init method found");
      return false;
    }
    catch (final ClassNotFoundException ex)
    {
      logger.warn ("⚠ " + displayName + " - Module not available in build");
      return false;
    }
    catch (final java.lang.reflect.InvocationTargetException ex)
    {
      final Throwable cause = ex.getCause ();
      final String errorMsg = cause != null ? cause.getMessage () : ex.getMessage ();
      logger.warn ("⚠ " + displayName + " - Failed to initialize: " + errorMsg);
      if (cause != null)
        logger.debug ("   Root cause: " + cause.getClass ().getName ());
      return false;
    }
    catch (final Exception ex)
    {
      logger.warn ("⚠ " + displayName + " - Failed to load: " + ex.getClass ().getSimpleName () + ": " + ex.getMessage ());
      return false;
    }
  }

  private static final class ModuleLoadStats
  {
    final int loadedModules;
    final int failedModules;

    ModuleLoadStats (final int loadedModules, final int failedModules)
    {
      this.loadedModules = loadedModules;
      this.failedModules = failedModules;
    }
  }
}

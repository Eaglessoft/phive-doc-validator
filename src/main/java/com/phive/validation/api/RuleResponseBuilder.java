package com.phive.validation.api;

import com.helger.json.IJsonArray;
import com.helger.json.IJsonObject;
import com.helger.json.JsonArray;
import com.helger.json.JsonObject;
import com.helger.json.serialize.JsonWriterSettings;
import com.helger.phive.api.executorset.IValidationExecutorSet;
import com.helger.phive.api.executorset.ValidationExecutorSetRegistry;
import com.helger.phive.xml.source.IValidationSourceXML;

final class RuleResponseBuilder
{
  IJsonObject buildRulesResponse (final ValidationExecutorSetRegistry<IValidationSourceXML> registry)
  {
    final IJsonObject response = new JsonObject ();
    final IJsonArray rules = new JsonArray ();

    for (final IValidationExecutorSet<IValidationSourceXML> ves : registry.getAll ())
    {
      final IJsonObject rule = new JsonObject ();
      final String vesid = ves.getID ().getAsSingleID ();
      rule.add ("vesid", vesid);
      rule.add ("name", ves.getDisplayName ());
      rule.add ("readableName", createReadableRuleName (vesid, ves.getDisplayName ()));
      if (ves.getStatus ().isDeprecated ())
        rule.add ("deprecated", true);
      rules.add (rule);
    }

    response.add ("rules", rules);
    response.add ("count", rules.size ());
    return response;
  }

  IJsonObject buildApiInfoResponse (final ValidationExecutorSetRegistry<IValidationSourceXML> registry)
  {
    final IJsonObject response = new JsonObject ();
    response.add ("service", "PHIVE Validation API");
    response.add ("version", "1.2.0");
    response.add ("status", "running");
    response.add ("buildType", "Local phive-rules (ALL 27 MODULES)");
    response.add ("availableRules", registry.getAll ().size ());
    response.add ("standards",
                  "All phive-rules modules: EN16931, Peppol, UBL, CII, XRechnung, ZUGFeRD, fatturaPA, OIOUBL, EHF, ebInterface, and 17 more...");
    return response;
  }

  String buildRulesResponseJson (final ValidationExecutorSetRegistry<IValidationSourceXML> registry, final boolean prettyPrint)
  {
    final IJsonObject response = buildRulesResponse (registry);
    if (prettyPrint)
      return response.getAsJsonString (JsonWriterSettings.DEFAULT_SETTINGS_FORMATTED);
    return response.getAsJsonString (JsonWriterSettings.DEFAULT_SETTINGS);
  }

  private String createReadableRuleName (final String vesid, final String displayName)
  {
    if (vesid == null || vesid.isEmpty ())
      return displayName != null ? displayName : "Unknown Rule";

    try
    {
      final String [] parts = vesid.split (":");
      if (parts.length >= 3)
      {
        final String groupId = parts[0];
        final String artifactId = parts[1];
        final String version = parts[2];

        String readableGroup = groupId;
        if (groupId.startsWith ("eu.peppol"))
        {
          readableGroup = "Peppol";
          if (groupId.contains ("bis3"))
            readableGroup += " BIS 3";
          else
            if (groupId.contains ("bis2"))
              readableGroup += " BIS 2";
            else
              if (groupId.contains ("bis"))
                readableGroup += " BIS";
        }
        else
          if (groupId.startsWith ("com.helger.phive"))
          {
            readableGroup = "PHIVE";
          }
          else
          {
            readableGroup = groupId.replaceAll ("\\.", " ");
            readableGroup = capitalizeWords (readableGroup);
          }

        final String readableArtifact = capitalizeWords (artifactId.replaceAll ("-", " ").replaceAll ("_", " "));
        return readableGroup + " " + readableArtifact + " " + version;
      }
    }
    catch (final Exception ignored)
    {
      // Keep fallback behavior on parsing problems.
    }

    return displayName != null && !displayName.isEmpty () ? displayName : vesid;
  }

  private String capitalizeWords (final String value)
  {
    if (value == null || value.isEmpty ())
      return value;

    final StringBuilder sb = new StringBuilder ();
    final String [] words = value.split ("\\s+");
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
}

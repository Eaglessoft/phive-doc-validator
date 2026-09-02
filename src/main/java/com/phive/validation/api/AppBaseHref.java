package com.phive.validation.api;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.ServletContext;

/**
 * Resolves the <code>&lt;base href&gt;</code> the UI templates are served with, and loads those
 * templates off the servlet context.
 *
 * <p>
 * Every asset URL in the HTML is relative and has no leading slash, so it resolves against this
 * value. That is what lets one WAR run at the context root during local development and behind the
 * <code>/peppol-e-invoice-xml-document-validator</code> prefix in production without the markup
 * changing. Links that address <em>other</em> services on the same origin - the portal, a sibling
 * tool - stay path-absolute on purpose: <code>&lt;base&gt;</code> does not touch those, so they
 * resolve against the origin alone, which is exactly what is wanted.
 *
 * <p>
 * Shared by {@link IndexServlet} and {@link ErrorPageServlet} so the two cannot drift.
 */
final class AppBaseHref
{
  static final String BASE_PLACEHOLDER = "__APP_BASE_HREF__";

  private static final String APP_CONTEXT_PATH_ENV = System.getenv ("APP_CONTEXT_PATH");
  private static final String CONTEXT_PATH_ENV = System.getenv ("CONTEXT_PATH");

  private AppBaseHref ()
  {}

  static String resolve ()
  {
    final String envPath = APP_CONTEXT_PATH_ENV != null && !APP_CONTEXT_PATH_ENV.trim ().isEmpty () ? APP_CONTEXT_PATH_ENV : CONTEXT_PATH_ENV;
    if (envPath != null && !envPath.trim ().isEmpty ())
      return normalize (envPath);
    return "/";
  }

  static String normalize (final String raw)
  {
    if (raw == null)
      return "/";

    final String trimmed = raw.trim ();
    if (trimmed.isEmpty () || "/".equals (trimmed))
      return "/";

    String normalized = trimmed;
    if (!normalized.startsWith ("/"))
      normalized = "/" + normalized;
    while (normalized.endsWith ("/"))
      normalized = normalized.substring (0, normalized.length () - 1);
    return normalized + "/";
  }

  /**
   * Loads a template from the web application root and substitutes the base-href placeholder.
   *
   * <p>
   * The substitution is a global replace, so each template must contain the placeholder exactly
   * once.
   */
  static String render (final ServletContext context, final String templatePath) throws IOException
  {
    try (InputStream stream = context.getResourceAsStream (templatePath))
    {
      if (stream == null)
        throw new IOException ("Cannot load template: " + templatePath);

      final String template = new String (stream.readAllBytes (), StandardCharsets.UTF_8);
      return template.replace (BASE_PLACEHOLDER, resolve ());
    }
  }
}

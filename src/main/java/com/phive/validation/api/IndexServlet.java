package com.phive.validation.api;

import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@WebServlet(urlPatterns = { "", "/index.html" })
public final class IndexServlet extends HttpServlet
{
  private static final long serialVersionUID = 1L;

  private static final String INDEX_TEMPLATE_PATH = "/index.html";
  private static final String BASE_PLACEHOLDER = "__APP_BASE_HREF__";

  private static final String APP_CONTEXT_PATH_ENV = System.getenv ("APP_CONTEXT_PATH");
  private static final String CONTEXT_PATH_ENV = System.getenv ("CONTEXT_PATH");

  @Override
  protected void doGet (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    if (isIndexHtmlRequest (request))
    {
      response.sendError (HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    final String baseHref = getEffectiveBaseHref ();
    final String template = loadIndexTemplate (request);
    final String html = template.replace (BASE_PLACEHOLDER, baseHref);

    response.setContentType ("text/html");
    response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
    try (PrintWriter writer = response.getWriter ())
    {
      writer.print (html);
      writer.flush ();
    }
  }

  private static boolean isIndexHtmlRequest (final HttpServletRequest request)
  {
    final String uri = request.getRequestURI ();
    return uri != null && uri.endsWith ("/index.html");
  }

  private static String getEffectiveBaseHref ()
  {
    final String envPath = APP_CONTEXT_PATH_ENV != null && !APP_CONTEXT_PATH_ENV.trim ().isEmpty () ? APP_CONTEXT_PATH_ENV : CONTEXT_PATH_ENV;
    if (envPath != null && !envPath.trim ().isEmpty ())
      return normalizeBaseHref (envPath);
    return "/";
  }

  private static String normalizeBaseHref (final String raw)
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

  private static String loadIndexTemplate (final HttpServletRequest request) throws IOException
  {
    try (InputStream stream = request.getServletContext ().getResourceAsStream (INDEX_TEMPLATE_PATH))
    {
      if (stream == null)
        throw new IOException ("Cannot load index template: " + INDEX_TEMPLATE_PATH + " for request URI " + request.getRequestURI ());

      final byte [] bytes = stream.readAllBytes ();
      return new String (bytes, StandardCharsets.UTF_8);
    }
  }
}

package com.phive.validation.api;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Serves the 404 and 500 pages through the same base-href substitution the index page uses.
 *
 * <p>
 * These were plain static files, which cannot work: <code>web.xml</code> dispatches to them
 * internally while the browser's address stays on the URL that failed, so a relative
 * <code>styles.css</code> resolved against that URL rather than the application root. The previous
 * workaround - path-absolute <code>/</code> links - only held while the app sat at the context
 * root, and pointed at the portal once it moved behind a path prefix. Rendering them as templates
 * gives them a correct <code>&lt;base&gt;</code> under any context path.
 */
@WebServlet (urlPatterns = { "/404.html", "/500.html" })
public final class ErrorPageServlet extends HttpServlet
{
  private static final long serialVersionUID = 1L;

  private static final String NOT_FOUND_TEMPLATE = "/404.html";
  private static final String SERVER_ERROR_TEMPLATE = "/500.html";

  @Override
  protected void doGet (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    final boolean serverError = isServerErrorRequest (request);
    final String template = serverError ? SERVER_ERROR_TEMPLATE : NOT_FOUND_TEMPLATE;

    // On an ERROR dispatch the container has already set the status; only a direct hit on
    // /404.html needs one. sendError() is deliberately not used - inside an error dispatch it
    // would re-enter this servlet.
    if (request.getAttribute (RequestDispatcher.ERROR_STATUS_CODE) == null)
      response.setStatus (serverError ? HttpServletResponse.SC_INTERNAL_SERVER_ERROR : HttpServletResponse.SC_NOT_FOUND);

    final String html = AppBaseHref.render (request.getServletContext (), template);

    // The ?v= query strings keep the browser honest about CSS and JS, but nothing
    // was protecting the document that references them: with no Cache-Control the
    // browser caches this page heuristically, so after a deploy a returning
    // visitor gets the new stylesheet against the old markup.
    response.setHeader ("Cache-Control", "no-cache, must-revalidate");
    response.setContentType ("text/html");
    response.setCharacterEncoding (StandardCharsets.UTF_8.name ());
    try (PrintWriter writer = response.getWriter ())
    {
      writer.print (html);
      writer.flush ();
    }
  }

  private static boolean isServerErrorRequest (final HttpServletRequest request)
  {
    final Object forwarded = request.getAttribute (RequestDispatcher.ERROR_REQUEST_URI);
    final String uri = forwarded instanceof String ? (String) forwarded : null;

    // The dispatched-to path, not the URI that failed, is what selects the template.
    final String servletPath = request.getServletPath ();
    if (servletPath != null && servletPath.endsWith ("/500.html"))
      return true;

    final Object status = request.getAttribute (RequestDispatcher.ERROR_STATUS_CODE);
    if (status instanceof Integer && ((Integer) status).intValue () >= 500)
      return true;

    return uri == null ? false : uri.endsWith ("/500.html");
  }
}

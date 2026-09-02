package com.phive.validation.api;

import java.io.IOException;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@WebServlet (urlPatterns = { "", "/index.html" })
public final class IndexServlet extends HttpServlet
{
  private static final long serialVersionUID = 1L;

  private static final String INDEX_TEMPLATE_PATH = "/index.html";

  @Override
  protected void doGet (final HttpServletRequest request, final HttpServletResponse response) throws ServletException, IOException
  {
    if (isIndexHtmlRequest (request))
    {
      response.sendError (HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    final String html = AppBaseHref.render (request.getServletContext (), INDEX_TEMPLATE_PATH);

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

  private static boolean isIndexHtmlRequest (final HttpServletRequest request)
  {
    final String uri = request.getRequestURI ();
    return uri != null && uri.endsWith ("/index.html");
  }
}

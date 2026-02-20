package com.phive.validation.api;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.PrintWriter;
import java.io.StringWriter;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.Test;

class ValidationServiceIntegrationTest
{
  @Test
  void apiEndpointReturnsHealthPayload () throws Exception
  {
    final ValidationService service = new ValidationService ();
    final HttpServletRequest request = mock (HttpServletRequest.class);
    final HttpServletResponse response = mock (HttpServletResponse.class);

    final StringWriter body = new StringWriter ();
    when (request.getRequestURI ()).thenReturn ("/api");
    when (request.getContextPath ()).thenReturn ("");
    when (response.getWriter ()).thenReturn (new PrintWriter (body));

    service.doGet (request, response);

    final String json = body.toString ();
    assertTrue (json.contains ("\"service\""));
    assertTrue (json.contains ("PHIVE Validation API"));
    assertTrue (json.contains ("\"availableRules\""));
  }

  @Test
  void listRulesEndpointReturnsRulesArray () throws Exception
  {
    final ValidationService service = new ValidationService ();
    final HttpServletRequest request = mock (HttpServletRequest.class);
    final HttpServletResponse response = mock (HttpServletResponse.class);

    final StringWriter body = new StringWriter ();
    when (request.getRequestURI ()).thenReturn ("/list-rules");
    when (request.getContextPath ()).thenReturn ("");
    when (response.getWriter ()).thenReturn (new PrintWriter (body));

    service.doGet (request, response);

    final String json = body.toString ();
    assertTrue (json.contains ("\"rules\""));
    assertTrue (json.contains ("\"count\""));
  }

  @Test
  void validateEndpointWithoutRuleReturnsErrorPayload () throws Exception
  {
    final ValidationService service = new ValidationService ();
    final HttpServletRequest request = mock (HttpServletRequest.class);
    final HttpServletResponse response = mock (HttpServletResponse.class);

    final StringWriter body = new StringWriter ();
    when (response.getWriter ()).thenReturn (new PrintWriter (body));

    service.doPost (request, response);

    final String json = body.toString ();
    assertTrue (json.contains ("Missing required parameter 'rule'"));
  }
}

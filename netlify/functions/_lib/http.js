function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function ok(body) {
  return json(200, body);
}

function badRequest(message, extra) {
  return json(400, { ok: false, error: message, ...extra });
}

function serverError(error) {
  return json(500, {
    ok: false,
    error: error && error.message ? error.message : 'Unexpected error',
  });
}

function parseBody(event) {
  return event && event.body ? JSON.parse(event.body) : {};
}

module.exports = {
  ok,
  badRequest,
  serverError,
  parseBody,
};


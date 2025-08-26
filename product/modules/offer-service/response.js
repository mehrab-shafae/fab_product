function makeResponse(status, data = {}) {
      return {
            status,
            data,
      };
}

module.exports = { makeResponse };

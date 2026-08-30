(() => {
  const host = window.location.hostname || "127.0.0.1";
  const backendHost = host;
  window.TRACKMYRAIL_CONFIG = window.TRACKMYRAIL_CONFIG || {};
  window.TRACKMYRAIL_CONFIG.ML_SERVICE_URL = window.TRACKMYRAIL_CONFIG.ML_SERVICE_URL || `http://${backendHost}:5000`;
  window.TRACKMYRAIL_CONFIG.LIVE_DATA_URL = window.TRACKMYRAIL_CONFIG.LIVE_DATA_URL || `${window.TRACKMYRAIL_CONFIG.ML_SERVICE_URL}/live-data`;
  window.ML_SERVICE_URL = window.TRACKMYRAIL_CONFIG.ML_SERVICE_URL;
  window.LIVE_DATA_URL = window.TRACKMYRAIL_CONFIG.LIVE_DATA_URL;
})();

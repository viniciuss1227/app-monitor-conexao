/**
 * forecastService.js
 * Comunicação direta com a Internet Quality API (Render Cloud)
 */

export const API_BASE_URL = 'https://internet-quality-api.onrender.com/api/v1';

/**
 * Catálogo de modelos ativos
 */
export async function getModels() {
  const response = await fetch(`${API_BASE_URL}/models`);
  if (!response.ok) {
    throw new Error('Falha ao obter catálogo de modelos.');
  }
  return await response.json();
}

/**
 * Previsão da sonda RIPE Atlas mais próxima
 */
export async function getNearbyForecast(lat, lon, modelId) {
  const url = `${API_BASE_URL}/forecasts/nearby?lat=${lat}&lon=${lon}&model_id=${modelId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao obter telemetria regional.');
  }
  return await response.json();
}

/**
 * Série temporal da sonda (previsões por horário)
 */
export async function getProbeTimeline(probeId, modelId) {
  const url = `${API_BASE_URL}/forecasts/probes/${probeId}/timeline?model_id=${modelId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Falha ao obter série temporal da sonda.');
  }
  return await response.json();
}

/**
 * Validação de viabilidade de atividade específica
 */
export async function checkActivity(modelId, latitude, longitude, activityType, isoDateTime) {
  const response = await fetch(`${API_BASE_URL}/activity/check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId,
      latitude,
      longitude,
      dateTime: isoDateTime,
      activity: activityType,
    }),
  });

  if (!response.ok) {
    throw new Error('Falha ao validar atividade.');
  }
  return await response.json();
}
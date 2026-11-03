import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// COLOQUE O SEU IPV4 AQUI (Exemplo: '192.168.15.24')
const MEU_IP_PC = '192.168.15.17'; // No PC Web pode deixar localhost; se for rodar no celular, coloque seu IP (ex: '192.168.15.24')

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'web' ? 'http://localhost:8080' : `http://${MEU_IP_PC}:8080`);

const STORAGE_KEY = '@selected_model_id';

export async function obterModeloSalvo() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) || 'model-a';
  } catch {
    return 'model-a';
  }
}

export async function salvarModelo(modelId) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, modelId);
  } catch {}
}

/**
 * 1. Lista modelos ativos: GET /api/v1/models
 */
export async function listarModelos() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/models`);
    if (!res.ok) throw new Error('API_ERROR');
    const data = await res.json();
    return data.items || [];
  } catch {
    throw new Error('NETWORK_ERROR');
  }
}

/**
 * 2. Busca previsão próxima: GET /api/v1/forecasts/nearby
 * NOTA: Omitir radius_km faz o Spring Boot buscar a sonda mais próxima
 * sem disparar o erro 404 de fora de raio em Mogi das Cruzes!
 */
export async function obterPrevisaoProxima(lat, lon, modelId, radiusKm = null) {
  let url = `${API_BASE_URL}/api/v1/forecasts/nearby?lat=${lat}&lon=${lon}&model_id=${encodeURIComponent(modelId)}`;
  
  // Só adiciona radius_km se for um número válido, evitando o erro de enviar "null"
  if (typeof radiusKm === 'number' && radiusKm > 0) {
    url += `&radius_km=${radiusKm}`;
  }

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  if (!res.ok) {
    let errorCode = `HTTP_${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.code) errorCode = errBody.error.code;
    } catch {}
    throw new Error(errorCode);
  }

  return await res.json();
}
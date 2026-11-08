import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import {
  getModels,
  getNearbyForecast,
  checkActivity,
  getProbeTimeline,
} from './src/services/forecastService';

// Cidades de referência com sondas mapeadas na API
const LOCATIONS = [
  { id: 'sp', name: 'São Paulo (SP)', coords: { lat: -23.5505, lon: -46.6333 } },
  { id: 'rj', name: 'Rio de Janeiro (RJ)', coords: { lat: -22.9068, lon: -43.1729 } },
  { id: 'am', name: 'Manaus (AM)', coords: { lat: -3.1190, lon: -60.0217 } },
  { id: 'gps', name: 'Meu GPS (Automático)', coords: null },
];

// Horários de teste rápido para a aba de atividades
const TIME_SLOTS = [
  { id: '18:00', label: '18:00', iso: '2026-08-20T18:00:00Z' },
  { id: '19:00', label: '19:00', iso: '2026-08-20T19:00:00Z' },
  { id: '20:00', label: '20:00 (Pico)', iso: '2026-08-20T20:00:00Z' },
  { id: '21:00', label: '21:00', iso: '2026-08-20T21:00:00Z' },
];

// As 6 atividades oficiais aceitas pela API
const ACTIVITIES = [
  { id: 'VIDEO_CALL', label: 'Videoconferência', icon: 'video' },
  { id: 'AUDIO_CALL', label: 'Chamada de áudio', icon: 'phone-call' },
  { id: 'STREAMING', label: 'Streaming HD', icon: 'tv' },
  { id: 'FILE_UPLOAD', label: 'Envio de arquivos', icon: 'upload-cloud' },
  { id: 'WEB_BROWSING', label: 'Navegação e estudos', icon: 'globe' },
  { id: 'MESSAGING', label: 'Mensagens instantâneas', icon: 'message-square' },
];

// Classificação em 3 níveis (Adequada, Com Ressalvas, Não Recomendada)
function getActivityEvaluation(result) {
  if (!result) return null;

  const isSuitable = result.suitable;
  const isModerate =
    result.recommendation?.code === 'REDUCE_NETWORK_USAGE' ||
    result.forecast?.quality === 'MODERATE';

  if (!isSuitable) {
    return {
      title: 'Não recomendada para este horário',
      color: '#EF4444',
      bg: '#7F1D1D20',
      border: '#DC2626',
      icon: 'alert-triangle',
    };
  }

  if (isModerate) {
    return {
      title: 'Adequada com ressalvas',
      color: '#F59E0B',
      bg: '#78350F20',
      border: '#D97706',
      icon: 'alert-circle',
    };
  }

  return {
    title: 'Adequada para este horário',
    color: '#10B981',
    bg: '#064E3B20',
    border: '#059669',
    icon: 'check-circle',
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('forecast'); // 'forecast' | 'activity'
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modelos
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('model-a');

  // Localização
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [currentCoords, setCurrentCoords] = useState(LOCATIONS[0].coords);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Previsão e Linha do Tempo (Aba Previsão)
  const [forecast, setForecast] = useState(null);
  const [timelineItems, setTimelineItems] = useState([]);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState(null);

  // Atividades (Aba Atividades)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[2]); // 20:00
  const [selectedActivity, setSelectedActivity] = useState('VIDEO_CALL');
  const [activityResult, setActivityResult] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
      setLoading(true);
      setErrorMsg(null);

      const savedModel = await AsyncStorage.getItem('@selected_model');
      const activeModel = savedModel || 'model-a';
      setSelectedModel(activeModel);

      const modelsData = await getModels();
      setModels(modelsData.items || []);

      const coords = LOCATIONS[0].coords;
      setCurrentCoords(coords);

      await fetchAllData(activeModel, coords, selectedTimeSlot.iso, selectedActivity);
    } catch {
      setErrorMsg('Serviço em inicialização no Render ou sem conexão com a internet.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllData(modelId, coords, timeIso, activityId) {
    try {
      // 1. Previsão da sonda mais próxima
      const forecastData = await getNearbyForecast(coords.lat, coords.lon, modelId);
      setForecast(forecastData);

      // 2. Linha do tempo da sonda encontrada
      const probeId = forecastData?.matchedProbe?.probeId || 900001;
      try {
        const timelineData = await getProbeTimeline(probeId, modelId);
        const items = timelineData?.items || [];
        setTimelineItems(items);
        const defaultItem = items.find((i) => i.predictionFor.includes('20:00')) || items[0] || null;
        setSelectedTimelineItem(defaultItem);
      } catch {
        setTimelineItems([]);
        setSelectedTimelineItem(null);
      }

      // 3. Validação da atividade
      setLoadingActivity(true);
      try {
        const actData = await checkActivity(modelId, coords.lat, coords.lon, activityId, timeIso);
        setActivityResult(actData);
      } catch {
        setActivityResult(null);
      } finally {
        setLoadingActivity(false);
      }
    } catch {
      setErrorMsg('Não foi possível sincronizar com a sonda regional.');
    }
  }

  async function handleModelSelect(modelId) {
    if (modelId === selectedModel) return;
    setSelectedModel(modelId);
    await AsyncStorage.setItem('@selected_model', modelId);
    if (currentCoords) {
      await fetchAllData(modelId, currentCoords, selectedTimeSlot.iso, selectedActivity);
    }
  }

  async function handleLocationChange(locOption) {
    setSelectedLocation(locOption);
    setLocationModalVisible(false);

    let targetCoords = locOption.coords;

    if (locOption.id === 'gps') {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          targetCoords = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        } else {
          targetCoords = LOCATIONS[0].coords;
        }
      } catch {
        targetCoords = LOCATIONS[0].coords;
      }
    }

    setCurrentCoords(targetCoords);
    await fetchAllData(selectedModel, targetCoords, selectedTimeSlot.iso, selectedActivity);
  }

  async function handleActivitySelect(activityId) {
    setSelectedActivity(activityId);
    if (currentCoords) {
      setLoadingActivity(true);
      try {
        const actData = await checkActivity(
          selectedModel,
          currentCoords.lat,
          currentCoords.lon,
          activityId,
          selectedTimeSlot.iso
        );
        setActivityResult(actData);
      } catch {
        setActivityResult(null);
      } finally {
        setLoadingActivity(false);
      }
    }
  }

  async function handleTimeSlotSelect(timeSlot) {
    setSelectedTimeSlot(timeSlot);
    if (currentCoords) {
      setLoadingActivity(true);
      try {
        const actData = await checkActivity(
          selectedModel,
          currentCoords.lat,
          currentCoords.lon,
          selectedActivity,
          timeSlot.iso
        );
        setActivityResult(actData);
      } catch {
        setActivityResult(null);
      } finally {
        setLoadingActivity(false);
      }
    }
  }

  const statusConfig = {
    GOOD: { label: 'Conexão Boa', color: '#10B981', bg: '#064E3B20', border: '#059669' },
    MODERATE: { label: 'Conexão Regular', color: '#F59E0B', bg: '#78350F20', border: '#D97706' },
    UNSTABLE: { label: 'Conexão Instável', color: '#EF4444', bg: '#7F1D1D20', border: '#DC2626' },
  };

  const activeQuality = selectedTimelineItem?.quality || forecast?.assessment?.quality;
  const activeScore = selectedTimelineItem?.qualityScore ?? forecast?.assessment?.qualityScore ?? '--';
  const activeRtt = selectedTimelineItem?.predictedAvgRttMs ?? forecast?.prediction?.predictedAvgRttMs;
  const activeLoss = selectedTimelineItem?.predictedPacketLossPct ?? forecast?.prediction?.predictedPacketLossPct;

  const currentStatus = statusConfig[activeQuality] || {
    label: 'Calculando', color: '#64748B', bg: '#1E293B', border: '#334155',
  };

  const formatHour = (iso) => {
    if (!iso) return '--:--';
    const match = iso.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : iso;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#080C14" />
      <View style={styles.appShell}>
        
        {/* Topo Global */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>SENTINELA DE REDES</Text>
            <Text style={styles.screenHeading}>
              {activeTab === 'forecast' ? 'Previsão Regional' : 'Validação de Tarefas'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.locationPill}
            onPress={() => setLocationModalVisible(true)}
          >
            <Feather name="map-pin" size={12} color="#818CF8" />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {selectedLocation.name.split(' (')[0]}
            </Text>
            <Feather name="chevron-down" size={13} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Seletor de Modelos */}
        <View style={styles.segmentedContainer}>
          {['model-a', 'model-b', 'model-c', 'model-d'].map((id, index) => {
            const isSelected = selectedModel === id;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.segmentTab, isSelected && styles.segmentTabActive]}
                onPress={() => handleModelSelect(id)}
              >
                <Text style={[styles.segmentLabel, isSelected && styles.segmentLabelActive]}>
                  {`Modelo ${String.fromCharCode(65 + index)}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Conteúdo com Scroll */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.centerLoadingText}>Sincronizando com a API do Render...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorSurface}>
              <Feather name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => bootstrap()}>
                <Text style={styles.retryBtnText}>Tentar Novamente</Text>
              </TouchableOpacity>
            </View>
          ) : activeTab === 'forecast' ? (
            /* ================= ABA 1: PREVISÃO GERAL ================= */
            <View>
              {/* Card de Estabilidade */}
              <View style={styles.cardSurface}>
                <View style={styles.cardHeader}>
                  <View style={[styles.statusBadge, { backgroundColor: currentStatus.bg, borderColor: currentStatus.border }]}>
                    <View style={[styles.statusDot, { backgroundColor: currentStatus.color }]} />
                    <Text style={[styles.statusBadgeText, { color: currentStatus.color }]}>
                      {currentStatus.label}
                    </Text>
                  </View>
                  <Text style={styles.scoreText}>
                    Índice <Text style={{ color: '#F8FAFC', fontWeight: '800' }}>{activeScore}</Text>/100
                  </Text>
                </View>

                <Text style={styles.recommendationMessage}>
                  {forecast?.recommendation?.message || 'Conexão operando dentro dos padrões históricos esperados.'}
                </Text>

                <View style={styles.probeFootnote}>
                  <Feather name="radio" size={13} color="#64748B" />
                  <Text style={styles.probeFootnoteText}>
                    Sonda RIPE #{forecast?.matchedProbe?.probeId ?? '---'} a {forecast?.matchedProbe?.distanceKm?.toFixed(1) ?? '--'} km
                  </Text>
                </View>
              </View>

              {/* Régua de Horários (Timeline Strip Deslizável) */}
              <View style={styles.timelineSectionHeader}>
                <Text style={styles.sectionTitle}>Comportamento por Horário</Text>
                <Text style={styles.sectionSub}>Arraste e selecione o horário</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timelineScrollList}
              >
                {timelineItems.length > 0 ? (
                  timelineItems.map((item) => {
                    const isSelected = selectedTimelineItem?.predictionFor === item.predictionFor;
                    const itemConf = statusConfig[item.quality] || statusConfig.MODERATE;
                    const hourText = formatHour(item.predictionFor);

                    return (
                      <TouchableOpacity
                        key={item.predictionFor}
                        style={[styles.timelineCard, isSelected && styles.timelineCardActive]}
                        onPress={() => setSelectedTimelineItem(item)}
                      >
                        <Text style={[styles.timelineHour, isSelected && styles.timelineHourActive]}>
                          {hourText}
                        </Text>
                        <View style={styles.timelineStatusRow}>
                          <View style={[styles.timelineDot, { backgroundColor: itemConf.color }]} />
                          <Text style={[styles.timelineScore, isSelected && styles.timelineScoreActive]}>
                            {item.qualityScore}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyTimelineText}>Carregando série temporal...</Text>
                )}
              </ScrollView>

              {/* Métricas Técnicas */}
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                Métricas Previstas {selectedTimelineItem ? `(${formatHour(selectedTimelineItem.predictionFor)})` : ''}
              </Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Latência (RTT)</Text>
                  <View style={styles.metricValRow}>
                    <Text style={styles.metricValue}>
                      {activeRtt !== undefined ? Number(activeRtt).toFixed(1) : '--'}
                    </Text>
                    <Text style={styles.metricUnit}>ms</Text>
                  </View>
                  <Text style={styles.metricHint}>Abaixo de 60 ms evita atrasos na transmissão de voz.</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Perda de Pacotes</Text>
                  <View style={styles.metricValRow}>
                    <Text style={styles.metricValue}>
                      {activeLoss !== undefined ? Number(activeLoss).toFixed(1) : '--'}
                    </Text>
                    <Text style={styles.metricUnit}>%</Text>
                  </View>
                  <Text style={styles.metricHint}>Acima de 2% causa travamentos perceptíveis em transmissões.</Text>
                </View>
              </View>

              <Text style={styles.disclaimer}>
                Referência pública via RIPE Atlas. Os dados refletem condições estruturais da rede regional, sem monitoramento de dispositivos individuais.
              </Text>
            </View>
          ) : (
            /* ================= ABA 2: PREVISÃO POR ATIVIDADE ================= */
            <View>
              <Text style={styles.sectionTitle}>Horário Previsto (Base 20/08)</Text>
              <View style={styles.timeSlotsRow}>
                {TIME_SLOTS.map((slot) => {
                  const isSelected = selectedTimeSlot.id === slot.id;
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.timeSlotPill, isSelected && styles.timeSlotPillActive]}
                      onPress={() => handleTimeSlotSelect(slot)}
                    >
                      <Text style={[styles.timeSlotPillText, isSelected && styles.timeSlotPillTextActive]}>
                        {slot.id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>O que você deseja fazer?</Text>
              <View style={styles.activitiesContainer}>
                {ACTIVITIES.map((act) => {
                  const isActive = selectedActivity === act.id;
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={[styles.activityRow, isActive && styles.activityRowActive]}
                      onPress={() => handleActivitySelect(act.id)}
                    >
                      <View style={styles.activityLeft}>
                        <View style={[styles.activityIconWrap, isActive && styles.activityIconWrapActive]}>
                          <Feather name={act.icon} size={15} color={isActive ? '#6366F1' : '#94A3B8'} />
                        </View>
                        <Text style={[styles.activityLabel, isActive && styles.activityLabelActive]}>
                          {act.label}
                        </Text>
                      </View>
                      <View style={[styles.radioCircle, isActive && styles.radioCircleActive]}>
                        {isActive && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Card de Veredito com 3 Níveis */}
              <View style={styles.resultSurface}>
                {loadingActivity ? (
                  <View style={styles.resultLoading}>
                    <ActivityIndicator size="small" color="#6366F1" />
                    <Text style={styles.resultLoadingText}>Avaliando estabilidade para às {selectedTimeSlot.id}...</Text>
                  </View>
                ) : activityResult ? (() => {
                  const evalStatus = getActivityEvaluation(activityResult);
                  return (
                    <View>
                      <View style={styles.resultVerdictRow}>
                        <Feather
                          name={evalStatus.icon}
                          size={18}
                          color={evalStatus.color}
                        />
                        <Text
                          style={[
                            styles.resultVerdictTitle,
                            { color: evalStatus.color },
                          ]}
                        >
                          {evalStatus.title}
                        </Text>
                      </View>
                      <Text style={styles.resultVerdictDescription}>
                        {activityResult.recommendation?.message ||
                          (activityResult.suitable
                            ? 'A conexão prevista atende a esta atividade neste período.'
                            : 'Há risco elevado de travamentos e oscilações.')}
                      </Text>
                    </View>
                  );
                })() : null}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Barra de Abas Inferior */}
        <View style={styles.bottomTabBar}>
          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('forecast')}>
            <Feather name="activity" size={18} color={activeTab === 'forecast' ? '#6366F1' : '#64748B'} />
            <Text style={[styles.tabButtonLabel, activeTab === 'forecast' && styles.tabButtonLabelActive]}>
              Previsão
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabButton} onPress={() => setActiveTab('activity')}>
            <Feather name="check-square" size={18} color={activeTab === 'activity' ? '#6366F1' : '#64748B'} />
            <Text style={[styles.tabButtonLabel, activeTab === 'activity' && styles.tabButtonLabelActive]}>
              Atividades
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal de Localização */}
      <Modal visible={locationModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar Região da Sonda</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Feather name="x" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {LOCATIONS.map((loc) => {
              const isSelected = selectedLocation.id === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                  onPress={() => handleLocationChange(loc)}
                >
                  <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextActive]}>
                    {loc.name}
                  </Text>
                  {isSelected && <Feather name="check" size={16} color="#6366F1" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080C14',
  },
  appShell: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#080C14',
    ...Platform.select({
      web: {
        marginVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#1E293B',
        overflow: 'hidden',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  brandTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 1.2,
  },
  screenHeading: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 2,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#131B2E',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  locationPillText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    marginHorizontal: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentTabActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  segmentLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 24,
  },
  centerContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  centerLoadingText: {
    marginTop: 12,
    fontSize: 12,
    color: '#94A3B8',
  },
  errorSurface: {
    backgroundColor: '#1E1520',
    borderWidth: 1,
    borderColor: '#4A1D24',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginVertical: 20,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 10,
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#E11D48',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardSurface: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scoreText: {
    fontSize: 12,
    color: '#64748B',
  },
  recommendationMessage: {
    fontSize: 13,
    color: '#E2E8F0',
    lineHeight: 19,
    marginBottom: 12,
  },
  probeFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
  },
  probeFootnoteText: {
    fontSize: 11,
    color: '#64748B',
  },
  timelineSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  timelineScrollList: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingRight: 10,
    marginBottom: 14,
  },
  timelineCard: {
    width: 68,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 10,
    alignItems: 'center',
    marginRight: 8,
  },
  timelineCardActive: {
    backgroundColor: '#1E293B',
    borderColor: '#6366F1',
  },
  timelineHour: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  timelineHourActive: {
    color: '#F8FAFC',
  },
  timelineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timelineScore: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  timelineScoreActive: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  emptyTimelineText: {
    fontSize: 11,
    color: '#64748B',
    paddingVertical: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  metricUnit: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 14,
  },
  disclaimer: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 4,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  timeSlotPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  timeSlotPillActive: {
    backgroundColor: '#312E81',
    borderColor: '#6366F1',
  },
  timeSlotPillText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  timeSlotPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activitiesContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  activityRowActive: {
    backgroundColor: '#1E293B40',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconWrapActive: {
    backgroundColor: '#312E81',
  },
  activityLabel: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  activityLabelActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#6366F1',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  resultSurface: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    minHeight: 70,
    justifyContent: 'center',
  },
  resultLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resultLoadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  resultVerdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  resultVerdictTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultVerdictDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 17,
  },
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0B1120',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabButtonLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonLabelActive: {
    color: '#6366F1',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: '#1E293B',
  },
  modalOptionText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  modalOptionTextActive: {
    color: '#F8FAFC',
    fontWeight: '600',
  },
});
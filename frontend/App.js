import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  obterModeloSalvo,
  salvarModelo,
  listarModelos,
  obterPrevisaoProxima,
} from './src/services/forecastService';

const FALLBACK_SP = { lat: -23.5505, lon: -46.6333 };

const GUIA_QUALIDADE = {
  GOOD: {
    titulo: 'Estável',
    subtitulo: 'Baixo risco de falhas',
    cor: '#10B981', // Verde
    badge: 'rgba(16, 185, 129, 0.15)',
    resumoPratico: 'Tudo liberado: chamadas de vídeo, streaming em alta resolução e jogos rodam sem travamento.',
  },
  MODERATE: {
    titulo: 'Moderada',
    subtitulo: 'Atenção em tarefas pesadas',
    cor: '#F59E0B', // Âmbar/Laranja
    badge: 'rgba(245, 158, 11, 0.15)',
    resumoPratico: 'Navegação, estudos e mensagens abrem normalmente. Vídeos ao vivo e reuniões podem oscilar.',
  },
  UNSTABLE: {
    titulo: 'Instável',
    subtitulo: 'Alto risco de travamento',
    cor: '#EF4444', // Vermelho
    badge: 'rgba(239, 68, 68, 0.15)',
    resumoPratico: 'Rede congestionada na região. Recomendado baixar arquivos antes para uso offline.',
  },
};

export default function App() {
  const [modelos, setModelos] = useState([]);
  const [modelId, setModelId] = useState('model-a');
  const [coords, setCoords] = useState(FALLBACK_SP);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    setCarregando(true);
    setErro(null);
    try {
      const [salvo, catalogo] = await Promise.all([
        obterModeloSalvo(),
        listarModelos(),
      ]);
      
      const nomesAbreviados = catalogo.map(m => ({
        ...m,
        shortName: m.name.replace('Modelo ', '') // Para caber na pill
      }));
      setModelos(nomesAbreviados);

      const idValido = catalogo.some((m) => m.id === salvo)
        ? salvo
        : catalogo[0]?.id || 'model-a';
      setModelId(idValido);

      let posicaoAtual = FALLBACK_SP;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc =
            (await Location.getLastKnownPositionAsync({})) ||
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
          if (loc?.coords) {
            posicaoAtual = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          }
        }
      } catch {}

      setCoords(posicaoAtual);
      const previsao = await obterPrevisaoProxima(posicaoAtual.lat, posicaoAtual.lon, idValido, null);
      setDados(previsao);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function trocarModelo(novoId) {
    setModelId(novoId);
    await salvarModelo(novoId);
    setCarregando(true);
    try {
      const previsao = await obterPrevisaoProxima(coords.lat, coords.lon, novoId, null);
      setDados(previsao);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Consultando previsão da rede em tempo real...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerBox}>
          <Ionicons name="cloud-offline-outline" size={48} color="#EF4444" style={{marginBottom: 16}}/>
          <Text style={styles.errorTitle}>Sem Conexão com o Servidor</Text>
          <Text style={styles.errorText}>
            Não foi possível comunicar com a API Java (porta 8080). Verifique se o servidor está ativo no terminal e tente novamente.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={inicializar}>
            <Text style={styles.retryText}>Tentar Novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!dados) return null;

  const quality = dados.assessment?.quality || 'MODERATE';
  const score = dados.assessment?.qualityScore ?? 65;
  const rtt = dados.prediction?.predictedAvgRttMs ?? 0;
  const loss = dados.prediction?.predictedPacketLossPct ?? 0;
  const distanceKm = dados.matchedProbe?.distanceKm ?? 0;
  const probeId = dados.matchedProbe?.probeId ?? 'N/A';
  const info = GUIA_QUALIDADE[quality] || GUIA_QUALIDADE.MODERATE;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F19" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <View>
            <Text style={styles.overline}>PAINEL DE PREVISÃO</Text>
            <Text style={styles.title}>Qualidade da Conexão</Text>
            <View style={styles.locationRow}>
              <View style={styles.liveDot} />
              <Text style={styles.locationText}>Sonda RIPE #{probeId} • Distância: {distanceKm} km</Text>
            </View>
          </View>
          <View style={styles.iconButton}>
            <Ionicons name="bar-chart" size={20} color="#06B6D4" />
          </View>
        </View>

        {/* SELETOR DE MODELOS */}
        <View style={styles.segmentedControl}>
          {modelos.map((m) => {
            const isAtivo = m.id === modelId;
            return (
              <TouchableOpacity 
                key={m.id}
                style={[styles.segmentTab, isAtivo && styles.segmentActive]}
                onPress={() => trocarModelo(m.id)}
              >
                <Text style={[styles.segmentText, isAtivo && styles.segmentTextActive]}>
                  Modelo {m.shortName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CARD PRINCIPAL (HERO) */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <Text style={styles.heroOverline}>ODS 9 • INFRAESTRUTURA</Text>
            <View style={styles.iconCircle}>
              <View style={styles.innerDot} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Diagnóstico de Estabilidade</Text>
          
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreSuffix}>/ 100</Text>
            <View style={{ flex: 1 }} />
            <View style={[styles.badgeContainer, { backgroundColor: info.badge, borderColor: info.badge }]}>
              <View style={[styles.badgeDot, { backgroundColor: info.cor }]} />
              <Text style={[styles.badgeText, { color: info.cor }]}>{info.titulo}</Text>
            </View>
          </View>
          
          <Text style={[styles.heroSubText, { color: info.cor }]}>{info.subtitulo}</Text>
          
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${score}%`, backgroundColor: info.cor }]} />
          </View>

          <View style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={22} color="#06B6D4" style={{ marginTop: 2 }} />
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Para o dia a dia</Text>
              <Text style={styles.tipText}>{info.resumoPratico}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Detalhes da previsão</Text>
          <Text style={styles.sectionSubtitle}>Agora</Text>
        </View>

        {/* GRID DE TELEMETRIA */}
        <View style={styles.gridContainer}>
          
          <View style={styles.gridCard}>
            <View style={styles.cardHeader}>
              <Feather name="activity" size={16} color="#94A3B8" />
              <Text style={styles.cardTitle}>Tempo de Resposta</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricValue}>{rtt}</Text>
              <Text style={styles.metricUnit}>ms</Text>
            </View>
            <View style={styles.badgeCyan}>
              <Text style={styles.badgeCyanText}>{rtt < 60 ? 'Resposta Rápida' : 'Atraso Moderado'}</Text>
            </View>
            <Text style={styles.cardDesc}>É a rapidez de resposta (Ping). Abaixo de 60 ms evita que sua voz atrase ou chamadas fiquem robóticas.</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="water-outline" size={16} color="#94A3B8" />
              <Text style={styles.cardTitle}>Perda de Dados</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricValue}>{loss}</Text>
              <Text style={styles.metricUnit}>%</Text>
            </View>
            <View style={styles.badgeCyan}>
              <Text style={styles.badgeCyanText}>{loss < 1 ? 'Quase Nula' : 'Atenção (Perda Visível)'}</Text>
            </View>
            <Text style={styles.cardDesc}>Pedaços de áudio ou imagem que falham no caminho. Acima de 2% faz vídeos travarem e carregarem (buffering).</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="bar-chart-outline" size={16} color="#94A3B8" />
              <Text style={styles.cardTitle}>Nota Geral</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricValue}>{score}</Text>
              <Text style={styles.metricUnit}>/ 100</Text>
            </View>
            <View style={styles.badgeCyan}>
              <Text style={styles.badgeCyanText}>Pontuação da Rede</Text>
            </View>
            <Text style={styles.cardDesc}>Nota unificada calculada pelo modelo. Quanto mais próxima de 100, mais estável e confiável é a conexão.</Text>
          </View>

          <View style={styles.gridCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="location-outline" size={16} color="#94A3B8" />
              <Text style={styles.cardTitle}>Sensor Regional</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricValue}>{distanceKm}</Text>
              <Text style={styles.metricUnit}>km</Text>
            </View>
            <View style={styles.badgeCyan}>
              <Text style={styles.badgeCyanText}>Distância da Sonda</Text>
            </View>
            <Text style={styles.cardDesc}>Distância até o sensor público de referência. Avalia a infraestrutura da região, não o roteador local.</Text>
          </View>

        </View>

        <Text style={styles.disclaimer}>{dados.metadata?.disclaimer || "A previsão está associada à probe RIPE Atlas como referência geográfica e não representa medição direta do dispositivo do usuário."}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  errorTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  overline: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  locationText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161D2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#161D2F',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  segmentActive: {
    backgroundColor: '#7C3AED',
  },
  segmentText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  heroCard: {
    backgroundColor: '#161D2F',
    borderRadius: 28,
    padding: 24,
    marginBottom: 28,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  heroOverline: {
    color: '#7C3AED',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7C3AED',
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: 'bold',
  },
  scoreSuffix: {
    color: '#94A3B8',
    fontSize: 18,
    marginLeft: 4,
    fontWeight: '500',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  heroSubText: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    marginBottom: 24,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#0B0F19',
    padding: 16,
    borderRadius: 20,
  },
  tipContent: {
    marginLeft: 12,
    flex: 1,
  },
  tipTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  tipText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#161D2F',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  metricUnit: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  badgeCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeCyanText: {
    color: '#06B6D4',
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardDesc: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
  },
  disclaimer: {
    color: '#64748B',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 14,
  }
});
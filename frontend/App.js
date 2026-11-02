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
import * as Location from 'expo-location';
import {
  obterModeloSalvo,
  salvarModelo,
  listarModelos,
  obterPrevisaoProxima,
} from './src/services/forecastService';

const FALLBACK_SP = { lat: -23.5505, lon: -46.6333 };

// Guia de linguagem acessível e simples para usuários leigos (ODS 9)
const GUIA_QUALIDADE = {
  GOOD: {
    titulo: 'Estável • Baixo Risco de Falhas',
    cor: '#00E676',
    resumoPratico: 'Tudo liberado: chamadas de vídeo, streaming em alta resolução e jogos rodam sem travamento.',
  },
  MODERATE: {
    titulo: 'Moderada • Atenção em Tarefas Pesadas',
    cor: '#FF4081', // Rosa/Magenta neon da referência visual
    resumoPratico: 'Navegação, estudos e mensagens abrem normalmente. Vídeos ao vivo e reuniões podem oscilar.',
  },
  UNSTABLE: {
    titulo: 'Instável • Alto Risco de Travamento',
    cor: '#FF5252',
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
      setModelos(catalogo);

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
      // Busca sem travar raio para garantir que encontre a sonda mais próxima sem erro
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

  // =========================================================================
  // TRATAMENTO DE ERROS AMIGÁVEL
  // =========================================================================
  if (carregando) {
    return (
      <SafeAreaView style={styles.telaFundo}>
        <View style={styles.containerMobile}>
          <View style={styles.centro}>
            <ActivityIndicator size="large" color="#E040FB" />
            <Text style={styles.textoStatus}>Consultando previsão da rede em tempo real...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (erro) {
    return (
      <SafeAreaView style={styles.telaFundo}>
        <View style={styles.containerMobile}>
          <View style={styles.centro}>
            <Text style={styles.tituloErro}>Sem Conexão com o Servidor</Text>
            <Text style={styles.textoStatus}>
              Não foi possível comunicar com a API Java (porta 8080). Verifique se o servidor está ativo no terminal e tente novamente.
            </Text>
            <TouchableOpacity style={styles.botaoPrimario} onPress={inicializar}>
              <Text style={styles.textoBotao}>Tentar Novamente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!dados) return null;

  const quality = dados.assessment?.quality || 'MODERATE';
  const score = dados.assessment?.qualityScore ?? 65;
  const rtt = dados.prediction?.predictedAvgRttMs ?? 0;
  const loss = dados.prediction?.predictedPacketLossPct ?? 0;
  const info = GUIA_QUALIDADE[quality] || GUIA_QUALIDADE.MODERATE;

  const pctRtt = Math.min(100, Math.max(10, (rtt / 160) * 100));
  const pctLoss = Math.min(100, Math.max(8, (loss / 6) * 100));

  return (
    <SafeAreaView style={styles.telaFundo}>
      <StatusBar barStyle="light-content" backgroundColor="#16152B" />

      <View style={styles.containerMobile}>
        {/* Brilho ambiental suave de fundo estilo Weather UI */}
        <View style={styles.brilhoAmbiental} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* CABEÇALHO */}
          <View style={styles.header}>
            <Text style={styles.tituloCidade}>Qualidade da Conexão</Text>
            <Text style={styles.subtituloHeader}>
              {score} pts  |  {info.titulo.split('•')[0]}
            </Text>
          </View>

          {/* SELETOR DE MODELOS (Persistência com AsyncStorage) */}
          <View style={styles.secaoModelos}>
            <Text style={styles.labelTopo}>MODELO DE PREVISÃO ATIVO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {modelos.map((m) => {
                const ativo = m.id === modelId;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.pilulaModelo, ativo && styles.pilulaModeloAtiva]}
                    onPress={() => trocarModelo(m.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo }}
                  >
                    <Text style={[styles.textoPilula, ativo && styles.textoPilulaAtivo]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* CARD PRINCIPAL (DIAGNÓSTICO E SAÚDE DA REDE) */}
          <View style={styles.cardGlass} accessible={true}>
            <Text style={styles.cardLabel}>DIAGNÓSTICO DE ESTABILIDADE (ODS 9)</Text>
            <Text style={styles.cardTitulo}>{info.titulo}</Text>

            {/* Barra Neon com ponto indicador da referência visual */}
            <View style={styles.trilhoBarra}>
              <View
                style={[
                  styles.preenchimentoBarra,
                  { width: `${score}%`, backgroundColor: info.cor },
                ]}
              />
              <View style={[styles.pontoBarra, { left: `${Math.min(96, Math.max(2, score))}%` }]} />
            </View>

            <Text style={styles.mensagemPrincipal}>{dados.recommendation?.message}</Text>
            <View style={styles.divisorCard} />
            <Text style={styles.resumoDidatico}>
              💡 <Text style={{ fontWeight: '700' }}>Para o dia a dia:</Text> {info.resumoPratico}
            </Text>
          </View>

          {/* GRADE BENTO 2x2: ACESSIBILIDADE E EXPLICAÇÃO PARA QUEM NÃO É DE TI */}
          <View style={styles.gradeBento}>
            {/* Widget 1: Atraso / Latência */}
            <View style={styles.cardQuadrado} accessible={true}>
              <Text style={styles.cardLabel}>TEMPO DE RESPOSTA</Text>
              <Text style={styles.valorGrande}>
                {rtt} <Text style={styles.unidade}>ms</Text>
              </Text>
              <Text style={[styles.subStatus, { color: rtt < 60 ? '#00E676' : '#FF4081' }]}>
                {rtt < 60 ? 'Resposta Rápida' : 'Atraso Moderado'}
              </Text>

              <View style={styles.trilhoMini}>
                <View style={[styles.preenchimentoMini, { width: `${pctRtt}%` }]} />
              </View>

              <Text style={styles.explicacaoLeiga}>
                É a rapidez de resposta (Ping). Abaixo de 60 ms evita que sua voz atrase ou que chamadas fiquem robóticas.
              </Text>
            </View>

            {/* Widget 2: Perda de Pacotes */}
            <View style={styles.cardQuadrado} accessible={true}>
              <Text style={styles.cardLabel}>PERDA DE DADOS</Text>
              <Text style={styles.valorGrande}>
                {loss}
                <Text style={styles.unidade}>%</Text>
              </Text>
              <Text style={[styles.subStatus, { color: loss < 1 ? '#00E676' : '#FF4081' }]}>
                {loss < 1 ? 'Quase Nula (< 1%)' : 'Atenção (Perda Visível)'}
              </Text>

              <View style={styles.trilhoMini}>
                <View style={[styles.preenchimentoMini, { width: `${pctLoss}%` }]} />
              </View>

              <Text style={styles.explicacaoLeiga}>
                Pedaços de áudio ou imagem que falham no caminho. Acima de 2% faz vídeos travarem e carregarem (buffering).
              </Text>
            </View>

            {/* Widget 3: Índice Geral */}
            <View style={styles.cardQuadrado} accessible={true}>
              <Text style={styles.cardLabel}>NOTA GERAL</Text>
              <Text style={styles.valorGrande}>
                {score} <Text style={styles.unidade}>/ 100</Text>
              </Text>
              <Text style={styles.subStatus}>Pontuação da Rede</Text>

              <Text style={styles.explicacaoLeiga}>
                Nota unificada calculada pelo modelo. Quanto mais próxima de 100, mais estável e confiável é a conexão.
              </Text>
            </View>

            {/* Widget 4: Ponto de Medição */}
            <View style={styles.cardQuadrado} accessible={true}>
              <Text style={styles.cardLabel}>SENSOR REGIONAL</Text>
              <Text style={styles.valorGrande}>
                {dados.matchedProbe?.distanceKm ?? 0} <Text style={styles.unidade}>km</Text>
              </Text>
              <Text style={styles.subStatus}>Sonda RIPE #{dados.matchedProbe?.probeId}</Text>

              <Text style={styles.explicacaoLeiga}>
                Distância até o sensor público de referência. Avalia a infraestrutura da região, não o roteador local.
              </Text>
            </View>
          </View>

          {/* DISCLAIMER OBRIGATÓRIO (ODS 9 / PRIVACIDADE) */}
          <Text style={styles.disclaimer}>{dados.metadata?.disclaimer}</Text>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  telaFundo: {
    flex: 1,
    backgroundColor: '#111022',
    alignItems: 'center',
  },
  containerMobile: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#1A1833',
    overflow: 'hidden',
  },
  brilhoAmbiental: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 260,
    height: 140,
    borderRadius: 130,
    backgroundColor: 'rgba(196, 39, 251, 0.16)',
  },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 36,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },

  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tituloCidade: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  subtituloHeader: {
    color: '#A09DC4',
    fontSize: 15,
    marginTop: 4,
  },

  secaoModelos: {
    marginBottom: 16,
  },
  labelTopo: {
    color: '#7E7B9E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  pilulaModelo: {
    backgroundColor: 'rgba(42, 39, 79, 0.65)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pilulaModeloAtiva: {
    backgroundColor: '#48319D',
    borderColor: '#E040FB',
  },
  textoPilula: {
    color: '#A09DC4',
    fontSize: 12,
    fontWeight: '600',
  },
  textoPilulaAtivo: {
    color: '#FFFFFF',
  },

  cardGlass: {
    backgroundColor: 'rgba(37, 34, 70, 0.82)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  gradeBento: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cardQuadrado: {
    width: '48.2%',
    backgroundColor: 'rgba(37, 34, 70, 0.82)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardLabel: {
    color: '#7E7B9E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  cardTitulo: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 14,
  },

  trilhoBarra: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    marginBottom: 14,
    justifyContent: 'center',
  },
  preenchimentoBarra: {
    height: 6,
    borderRadius: 3,
  },
  pontoBarra: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  trilhoMini: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 2,
    marginVertical: 10,
  },
  preenchimentoMini: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E040FB',
  },

  mensagemPrincipal: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  divisorCard: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  resumoDidatico: {
    color: '#B8B5D6',
    fontSize: 12,
    lineHeight: 18,
  },
  valorGrande: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '500',
  },
  unidade: {
    fontSize: 15,
    color: '#A09DC4',
    fontWeight: '400',
  },
  subStatus: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  explicacaoLeiga: {
    color: '#9693B8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },

  tituloErro: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  textoStatus: {
    color: '#A09DC4',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
  },
  botaoPrimario: {
    backgroundColor: '#48319D',
    borderColor: '#E040FB',
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  textoBotao: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  disclaimer: {
    color: '#6C698E',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 6,
  },
});
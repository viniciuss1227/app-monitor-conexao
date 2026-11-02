# 🌐 Sistema de Monitoramento e Previsão de Qualidade de Conectividade

> **Projeto Interdisciplinar — Análise e Projeto de Sistemas II (APS II)**  
> **Centro Universitário Braz Cubas — Semestre 2026/2**  
> **Integração Curricular:** Programação para Dispositivos Móveis • Análise e Projeto de Sistemas • Redes de Computadores  
> **Docentes Responsáveis:** Prof. Davi de Oliveira Cruz, Profa. Aline dos Santos e Profa. Denise Braito

--- 

## 📌 Visão Geral do Produto

O **Sistema de Monitoramento e Previsão de Qualidade de Conectividade** é uma solução desenvolvida para mitigar o impacto da imprevisibilidade da internet para usuários em regime de teletrabalho, estudo a distância e tarefas digitais críticas. A plataforma cruza dados históricos de telemetria pública com modelos de inteligência artificial para antecipar períodos de degradação da conexão, traduzindo métricas complexas de infraestrutura em diretrizes práticas para a tomada de decisão.

O projeto está fundamentado no **ODS 9 (Indústria, Inovação e Infraestrutura)** da ONU, promovendo a inclusão digital e reduzindo a assimetria técnica por meio de uma interface desenhada sob os preceitos de baixa carga cognitiva, sem coleta de dados privados e acessível para usuários não especialistas.

---

## 📱 Demonstração Visual

| Interface do Aplicativo (React Native) | Documentação Interativa (Swagger OpenAPI) |
| :--<img width="434" height="864" alt="Modelo A" src="https://github.com/user-attachments/assets/1b34dd59-37c4-475f-88d6-07204c980309" />
<img width="427" height="871" alt="Modelo C" src="https://github.com/user-attachments/assets/2963bdef-c186-4956-8a77-851099530d14" />
-: | <img width="1155" height="730" alt="Swagger" src="https://github.com/user-attachments/assets/5caef3ab-5ce1-4749-a30f-4cdfa7f9404a" /> |
| *(Adicione a imagem do app aqui)* | *(Adicione a imagem do Swagger aqui)* |

---

## 📡 Fundamentos de Redes de Computadores & Telemetria

O sistema apoia-se em conceitos estruturais da arquitetura de redes para transformar medições brutas em recomendações contextualizadas:

- **Auditoria de Sistemas Autônomos (RIPE Atlas & ASNs):** As previsões utilizam como referência geográfica sondas públicas instaladas em Sistemas Autônomos (ASNs) estratégicos no Brasil. Isso permite monitorar a saúde dos pontos de troca de tráfego (IXPs) e do trânsito IP regional, desacoplando a infraestrutura pública de eventuais interferências pontuais no enlace local (Wi-Fi).
- **Métricas Ativas de Qualidade de Serviço (QoS):**
  - **RTT (Round Trip Time / Latência):** Monitora o retardo de propagação e enfileiramento dos pacotes (em milissegundos). Atrasos abaixo de 60 ms garantem comunicação interativa sem percepção de atraso.
  - **Packet Loss (Perda de Pacotes):** Avalia a taxa de descarte provocada por congestionamento em buffers de roteadores. Valores superiores a 2% degradam substancialmente serviços síncronos.
  - **Jitter (Variação de Atraso):** Oscilações na chegada dos pacotes que provocam dessincronização de áudio e vídeo em tempo real.
- **Tolerância por Protocolo da Camada de Transporte:**
  - **Tráfego em Tempo Real (UDP / RTP):** Aplicado a chamadas de vídeo e voz. Por não utilizar mecanismos de retransmissão, exige latência estrita e descarte mínimo para evitar interrupções.
  - **Tráfego Confiável com Controle de Fluxo (TCP):** Aplicado a navegação e streaming de mídia. Buffers locais toleram latência moderada, mas a perda de pacotes ativa algoritmos de recuo da janela de congestionamento (Congestion Window), causando lentidão perceptível.
- **Transição de QoS para QoE:** O sistema converte indicadores de QoS da camada de rede em Qualidade de Experiência (QoE) voltada ao usuário final, informando se a conexão é adequada para reuniões, estudos ou se exige preparação de recursos offline.

---

## 📁 Estrutura do Monorepo

O projeto está organizado no modelo de monorepo estruturado, separando a aplicação móvel dos serviços de retaguarda:

```text
app-monitor-conexao/
├── frontend/               # Aplicativo móvel (React Native / Expo)
│   ├── assets/             # Recursos estáticos e ícones
│   ├── src/
│   │   └── services/       # Integração REST com a API Java (forecastService.js)
│   ├── App.js              # Camada de apresentação com foco em acessibilidade
│   ├── app.json            # Configurações do ecossistema Expo
│   └── package.json        # Dependências Node.js e scripts de inicialização
│
├── backend/                # API RESTful de Previsão (Java Spring Boot 3)
│   ├── data/               # Séries temporais históricas (predictions.csv e models.json)
│   ├── src/                # Controladores, regras de negócio e repositórios
│   └── pom.xml             # Manifesto de build Maven e dependências (JaCoCo)
│
├── .gitignore              # Regras de exclusão de artefatos temporários
└── README.md               # Documentação técnica unificada do repositório
```

---

## 🛠️ Tecnologias Utilizadas

### Frontend (Mobile)
- **Framework:** React Native com Expo
- **Persistência Local:** `@react-native-async-storage/async-storage` (Guarda o identificador do modelo escolhido no dispositivo)
- **Localização:** `expo-location` (Recupera coordenadas com tolerância a falhas e contingência para a Grande SP)
- **Design System:** Padrão Dark Glassmorphism, alto contraste visual e feedback em neon
- **Acessibilidade:** Diretrizes da WCAG 2.2 (Nível AA) e ABNT NBR 17060, com compatibilidade com leitores de tela (**TalkBack** e **VoiceOver**)

### Backend (API REST)
- **Linguagem & Framework:** Java 17 com Spring Boot 3.4.0
- **Documentação de API:** OpenAPI 3 / Swagger UI
- **Processamento de Séries Temporais:** Leitura em memória de arquivos CSV e JSON padronizados
- **Testes & Cobertura:** JUnit 5, Mockito e relatórios de cobertura de código via **JaCoCo**

---

## 🔌 Contratos da API & Status de Integração

A API RESTful em Java Spring Boot disponibiliza os seguintes contratos documentados via OpenAPI/Swagger, integrados ao aplicativo móvel conforme o escopo do *Walking Skeleton*:

| Método | Endpoint | Finalidade | Status no App Mobile |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/models` | Obtenção do catálogo de modelos de inteligência artificial | **Consumido** (Seleção de IA) |
| `GET` | `/api/v1/forecasts/nearby` | Previsão por coordenadas geográficas (`lat`, `lon`, `model_id`) | **Consumido** (Telemetria & Diagnóstico) |
| `GET` | `/api/v1/health` | Validação de integridade e disponibilidade do backend | **Consumido** (Diagnóstico & *Smoke Test*) |
| `GET` | `/api/v1/locations` | Listagem das sondas públicas RIPE Atlas mapeadas | Documentado (Resolvido via GPS) |
| `POST` | `/api/v1/activity/check` | Checagem de conformidade para tarefas específicas | Mapeado no Backend (Backlog Futuro) |
| `GET` | `/api/v1/forecasts/probes/{id}/timeline` | Projeção temporal horária para as próximas 24 horas | Mapeado no Backend (Backlog Futuro) |

---

## ♿ Requisitos Não Funcionais & Acessibilidade (RNF01 a RNF09)

- **Tradução Contextual:** Eliminação de barreiras cognitivas pela substituição de jargões técnicos por termos autoexplicativos:
  - *Latência / RTT* → **Tempo de Resposta (Atraso)**
  - *Packet Loss* → **Falha / Perda de Dados**
  - *Quality Score* → **Nota Geral da Conexão (0 a 100)**
- **Independência de Cor:** Todos os estados de rede (Boa, Moderada, Instável) contam com rótulos textuais explícitos e ícones semânticos associados.
- **Resiliência de Interface:** Tratamento de erros de rede (HTTP 404, 422 e perda de conectividade) por meio de telas de estado vazio (*Empty States*) amigáveis com botão de reconexão.
- **Transparência e Privacidade:** Exibição clara do aviso legal (*disclaimer*) obrigatório, informando que os dados decorrem de sondas geográficas de referência pública e não violam a privacidade do usuário.

---

## 🚀 Como Executar o Projeto Localmente

### 1. Inicializar a API (Backend Java)
```bash
cd backend
mvn spring-boot:run
```
*O servidor estará ativo em `http://localhost:8080`. Documentação disponível em `http://localhost:8080/swagger-ui.html`.*

### 2. Inicializar o Aplicativo (Frontend React Native)
Em um novo terminal:
```bash
cd frontend
npm install
npx expo start -c
```
- Pressione **`w`** para visualizar a versão Web no navegador.
- Para rodar no dispositivo móvel, escaneie o QR Code através do **Expo Go** (garantindo que o IP local do computador esteja parametrizado no serviço).

---

## 👥 Integrantes da Squad

- **Vinicius Matheus da Silva Rocha** — RGM: `43073328`
- **Matheus Hideki Beltran Iqueoka** — RGM: `43347444`
- **Nara Cauany Ariette de Godoy** — RGM: `40450902`
- **Ana Clara de Oliveira Gimenes** — RGM: `43577725`

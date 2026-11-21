"use client";

import { useState, useEffect, useRef, useMemo, useId } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import dynamic from "next/dynamic";
import { 
  Wallet, TrendingDown,
  Bell, User, Plus, CreditCard, 
  ChevronLeft, ChevronRight, Sparkles, LineChart, Target,
  PieChart as PieChartIcon, Search, Trash2, Heart, Clock, Calendar, FileText, Eye, EyeOff,
  PiggyBank, MoreHorizontal, Bot, SlidersHorizontal, CalendarClock,
  WifiOff, RefreshCw, X, MessageSquare
} from "lucide-react";

import { TransactionRow } from "../components/TransactionRow";
import { EmptyState, SkeletonRow } from "../components/ui/Surface";
import { EsqueletoVisaoGeral } from "../components/EsqueletoVisaoGeral";


/**
 * Modais sob demanda.
 *
 * Todos os 25 viviam no pacote da primeira tela: o painel pesava 211 KB, o
 * dobro de qualquer outra rota, para carregar coisa que só existe depois de
 * um toque. Cada um agora é um pedaço separado, buscado na hora de abrir.
 *
 * `ssr: false` porque nenhum deles renderiza no servidor — são sobreposições
 * que só existem depois que a pessoa interage.
 */
const TransactionModal = dynamic(() => import("../components/TransactionModal").then(m => m.TransactionModal), { ssr: false });
const EditTransactionModal = dynamic(() => import("../components/EditTransactionModal").then(m => m.EditTransactionModal), { ssr: false });
const IncomeListModal = dynamic(() => import("../components/IncomeListModal").then(m => m.IncomeListModal), { ssr: false });
const AiUploadModal = dynamic(() => import("../components/AiUploadModal").then(m => m.AiUploadModal), { ssr: false });
const AdvisorModal = dynamic(() => import("../components/AdvisorModal").then(m => m.AdvisorModal), { ssr: false });
const SubscriptionTrackerModal = dynamic(() => import("../components/SubscriptionTrackerModal").then(m => m.SubscriptionTrackerModal), { ssr: false });
const ReportsModal = dynamic(() => import("../components/ReportsModal").then(m => m.ReportsModal), { ssr: false });
const ActivityModal = dynamic(() => import("../components/ActivityModal").then(m => m.ActivityModal), { ssr: false });
const ProfileModal = dynamic(() => import("../components/ProfileModal").then(m => m.ProfileModal), { ssr: false });
const CoupleModal = dynamic(() => import("../components/CoupleModal").then(m => m.CoupleModal), { ssr: false });
const FinancialCalendarModal = dynamic(() => import("../components/FinancialCalendarModal").then(m => m.FinancialCalendarModal), { ssr: false });
const WalletsModal = dynamic(() => import("../components/WalletsModal").then(m => m.WalletsModal), { ssr: false });
const BudgetModal = dynamic(() => import("../components/BudgetModal").then(m => m.BudgetModal), { ssr: false });
const WelcomeModal = dynamic(() => import("../components/WelcomeModal").then(m => m.WelcomeModal), { ssr: false });
const GoalsModal = dynamic(() => import("../components/GoalsModal").then(m => m.GoalsModal), { ssr: false });
const CategoryManagerModal = dynamic(() => import("../components/CategoryManagerModal").then(m => m.CategoryManagerModal), { ssr: false });
const PayYourselfFirstModal = dynamic(() => import("../components/PayYourselfFirstModal").then(m => m.PayYourselfFirstModal), { ssr: false });
const CreditCardManagerModal = dynamic(() => import("../components/CreditCardManagerModal").then(m => m.CreditCardManagerModal), { ssr: false });
const StageRoadmapModal = dynamic(() => import("../components/StageRoadmapModal").then(m => m.StageRoadmapModal), { ssr: false });
const PillarDetailModal = dynamic(() => import("../components/PillarDetailModal").then(m => m.PillarDetailModal), { ssr: false });
const DebtsModal = dynamic(() => import("../components/DebtsModal").then(m => m.DebtsModal), { ssr: false });
const SpendingInsightsModal = dynamic(() => import("../components/SpendingInsightsModal").then(m => m.SpendingInsightsModal), { ssr: false });
const ForecastModal = dynamic(() => import("../components/ForecastModal").then(m => m.ForecastModal), { ssr: false });
const ProfileSettingsModal = dynamic(() => import("../components/ProfileSettingsModal").then(m => m.ProfileSettingsModal), { ssr: false });
const InvestmentsModal = dynamic(() => import("../components/InvestmentsModal").then(m => m.InvestmentsModal), { ssr: false });

import { supabase } from "../lib/supabase";
import { toast, toastWithUndo } from "../components/Toast";
import { confirmDialog } from "../components/ConfirmDialog";
import { getProfileInsights, getStageLadder, getProximoPasso, type FinancialProfile } from "../lib/profile";
import { AI_ENABLED } from "../lib/features";
import { formatMoney } from "../lib/format";
import { normalizarSubcategoria, NAO_CLASSIFICADO } from "../lib/subcategorias";
import { getUserId } from "../lib/session";
import { summarizeDebts } from "../lib/debt";
import { linhasDaMesmaFatura } from "../lib/fatura";
import { moverNaMeta } from "../lib/aporte-meta";
import { hojeEmSaoPaulo, rotuloDoDia } from "../lib/data";
import { agruparPorDia } from "../lib/lancamentos";
import { primeiroNome, saudacao } from "../lib/saudacao";
import { abrirFeedback, ROTULO_FEEDBACK } from "../components/FeedbackWidget";
import { ResumoOndeFoi } from "../components/ResumoOndeFoi";
import { JornadaCard } from "../components/JornadaCard";
import { CardQuantoSobra } from "../components/CardQuantoSobra";
import { AlertaGargalo } from "../components/AlertaGargalo";
import { dividirRenda, type IdDoSegmento } from "../lib/divisao-renda";
import { EVENTO_MODO_SELECAO } from "../components/BottomNav";
import { buscarTudo, PAGINA } from "../lib/consultas";
import { BetaGate } from "../components/BetaGate";
import { OnboardingChecklist } from "../components/OnboardingChecklist";
import type { StepId } from "../lib/onboarding";

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/**
 * Janela de transações carregadas.
 *
 * O dashboard baixava o histórico INTEIRO do usuário a cada abertura, sem
 * limite. Com dois anos de uso isso vira milhares de linhas trafegadas e
 * percorridas em memória a cada render.
 *
 * Não dá para carregar só o mês corrente: o diagnóstico compara com a mediana
 * dos últimos meses, a recorrência precisa de meses consecutivos e a previsão
 * depende das PARCELAS FUTURAS já lançadas. Por isso a janela abre para os
 * dois lados.
 *
 *   18 meses atrás  -> cobre com folga as análises, que olham 3 a 6 meses
 *   24 meses à frente -> cobre parcelamentos longos (24x é o teto comum)
 *
 * LIMITAÇÃO CONHECIDA: o Relatórios recebe esta mesma lista, então ele também
 * passa a enxergar no máximo 18 meses para trás. Hoje isso não muda nada — o
 * gráfico de barras mostra 6 meses —, mas quando o app precisar de histórico
 * longo, aquela tela terá que buscar o próprio período em vez de reaproveitar
 * o que o dashboard carregou.
 */
/**
 * Colunas de `transactions` que o app lê.
 *
 * Substitui o `select('*')`, que arrastava tudo que a tabela viesse a ter.
 * `is_split` entra mesmo sem ser lido na tela: o desfazer de exclusão
 * reinsere a linha que estava em memória, e coluna ausente aqui some na
 * restauração.
 */
const COLUNAS_TX = 'id, user_id, title, amount, category, subcategoria, type, date, is_paid, is_split, installment_group, installment_info, import_group, receipt_url, wallet_id, goal_id';

const TX_WINDOW = (() => {
  const from = new Date();
  from.setMonth(from.getMonth() - 18);
  const to = new Date();
  to.setMonth(to.getMonth() + 24);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
})();

/**
 * As transacoes da janela do painel, SEM o corte de mil linhas.
 *
 * Esta consulta sustenta todo numero da tela. Pedida de uma vez, o
 * PostgREST devolveria no maximo 1.000 linhas em silencio e o painel
 * somaria um pedaco do mes achando que somou o mes.
 */
function buscarTransacoesDaJanela(userId: string) {
  /* `async` + `await` de propósito: o construtor do supabase-js é "thenable",
     mas não é uma Promise completa, e `buscarTudo` pede uma. */
  return buscarTudo<any>(async (de, ate) =>
    await supabase
      .from('transactions')
      .select(COLUNAS_TX)
      .eq('user_id', userId)
      .gte('date', TX_WINDOW.from)
      .lte('date', TX_WINDOW.to)
      /* Ordem TOTAL, não só por data: com várias linhas na mesma data, o
         Postgres não garante a mesma ordem entre páginas, e a emenda
         poderia repetir uma linha e perder outra. O desempate por `id`
         torna a paginação determinística. */
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(de, ate),
  );
}


export default function Dashboard() {
  // Meses ja buscados fora da janela, para nao repetir consulta ao voltar.
  const mesesExtras = useRef(new Set<string>());
  const idBusca = useId();
  // Contêiner do card "Onde foi o dinheiro": destino do "Ver onde cortar".
  const ondeFoiRef = useRef<HTMLDivElement>(null);
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [showValues, setShowValues] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  // Qual item da divisão da renda teve os lançamentos abertos.
  const [pilarAberto, setPilarAberto] = useState<null | IdDoSegmento>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false); 
  const [isPlannerOpen, setIsPlannerOpen] = useState(false); 
  const [isTrackerOpen, setIsTrackerOpen] = useState(false); 
  const [isReportsOpen, setIsReportsOpen] = useState(false); 
  const [isActivityOpen, setIsActivityOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isCoupleOpen, setIsCoupleOpen] = useState(false); 
  const [isGoalsOpen, setIsGoalsOpen] = useState(false); 
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isWalletsOpen, setIsWalletsOpen] = useState(false);
  const [isPayYourselfOpen, setIsPayYourselfOpen] = useState(false);
  const [isCardsOpen, setIsCardsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [isInvestmentsOpen, setIsInvestmentsOpen] = useState(false);
  const [isDebtsOpen, setIsDebtsOpen] = useState(false);
  const [isSpendingOpen, setIsSpendingOpen] = useState(false);
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [debts, setDebts] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Escutar eventos do BottomNav
  useEffect(() => {
    const handleOpenModal = (e: any) => {
      const name = e.detail;
      if (name === 'casais') setIsCoupleOpen(true);
      if (name === 'relatorios') setIsReportsOpen(true);
      if (name === 'config') setIsProfileOpen(true);
      if (name === 'manual') setIsModalOpen(true);
      if (name === 'camera' && AI_ENABLED) setIsAiModalOpen(true);
      if (name === 'poupar') setIsPayYourselfOpen(true);
      if (name === 'cartoes') setIsCardsOpen(true);
    };
    window.addEventListener('openModal', handleOpenModal);
    return () => window.removeEventListener('openModal', handleOpenModal);
  }, []);

  /** Quantas contas a vencer havia quando a pessoa dispensou o aviso.
   *  null = nunca dispensou. Ver `hasUnread`, mais abaixo. */
  const [dispensadoCom, setDispensadoCom] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  /**
   * Por que a falha de carregamento tem estado próprio.
   *
   * Antes, toda resposta era lida como `if (resposta.data) setX(...)`. Quando
   * a consulta falhava, `data` vinha null, o carregamento terminava igual, e o
   * painel desenhava R$ 0,00 em tudo.
   *
   * Num app de dinheiro, "você não tem nada" e "não consegui carregar" são
   * frases opostas, e a primeira assusta de graça. Pior: ela é indistinguível
   * de perda de dados para quem está olhando.
   */
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState("client");
  const [profile, setProfile] = useState<FinancialProfile | null>(null);

  /**
   * Nome do usuário para a saudação do cabeçalho.
   *
   * HOJE É SEMPRE NULO, DE PROPÓSITO. O app não coleta nome em lugar nenhum:
   * o cadastro não manda `options.data`, então `user_metadata` nasce vazio; o
   * `handle_new_user` grava só `id` e `role`; nem o `WelcomeModal` nem o
   * `ProfileSettingsModal` perguntam. Não existe coluna de nome em `profiles`,
   * e nenhum nome de coluna foi presumido aqui — inventar um faria a tela
   * depender de algo que o banco não tem.
   *
   * PONTO DE LIGAÇÃO: quando o nome passar a ser coletado, basta trocar este
   * `null` pelo campo do perfil. A consulta é `select('*')` (ver
   * `carregarPainel`), então a coluna nova chega sozinha, sem mexer na busca.
   *
   * Enquanto for nulo, o cabeçalho mostra só a saudação ("Bom dia") — melhor
   * que o pedaço do e-mail antes do @, que não é nome de ninguém.
   */
  const nomeDoPerfil: string | null = null;
  /** `''` quando não há nome — e aí a saudação aparece sozinha. */
  const nomeParaSaudacao = primeiroNome(nomeDoPerfil);

  const [goals, setGoals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPending, setFilterPending] = useState(false);
  /** Grupo de "Onde foi o dinheiro" aberto na lista. Null = sem filtro. */
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<string | null>(null);
  /** A lista mostra 8 por padrão. Uma fatura importada traz dezenas. */
  const [mostrarTodos, setMostrarTodos] = useState(false);
  /** Seleção múltipla: uma importação traz dezenas de linhas, e apagar uma a
   *  uma é inviável. Vale para qualquer lançamento, não só os importados. */
  const [modoSelecao, setModoSelecao] = useState(false);
  /** Um lançamento com as ações abertas por vez (modo toque). Guarda o id MAIS
   *  a assinatura do recorte da lista: busca e filtros trocam o conteúdo da
   *  lista, e sem isso a linha aberta que saía do recorte voltava ABERTA quando
   *  o filtro saía (achado do QA da rodada 2). É derivado na leitura em vez de
   *  um `useEffect` que zera: o lint proíbe setState em efeito
   *  (`react-hooks/set-state-in-effect`), e com razão — isto não é sincronismo
   *  de estado, é uma pergunta que a lista já sabe responder. */
  const [acoesAbertas, setAcoesAbertas] = useState<{ id: string; recorte: string } | null>(null);
  const recorteAtual = `${searchQuery}|${filterPending}|${subcategoriaFiltro ?? ''}|${mostrarTodos}`;
  const [selecionados, setSelecionados] = useState<string[]>([]);
  
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // O grupo aberto é do mês que estava na tela. Carregá-lo para o mês seguinte
  // mostraria uma lista vazia com um filtro que a pessoa não escolheu ali.
  const limparRecorte = () => {
    setSubcategoriaFiltro(null);
    setMostrarTodos(false);
    // A seleção também sai. Sem isto dava para marcar 3 num grupo, trocar de
    // grupo, marcar mais 2, e apagar 5 — três deles fora da tela.
    setModoSelecao(false);
    setAcoesAbertas(null);
    setSelecionados([]);
  };

  /**
   * Busca um mês que está fora da janela carregada.
   *
   * A janela vai de -18 a +24 meses, e as setas de mês não param nela. Quem
   * passasse do limite via R$ 0,00 em tudo — sem erro, sem aviso, como se não
   * houvesse nada lançado. Agora o mês é buscado na hora e entra na lista.
   *
   * O custo é uma consulta por mês visitado, só na primeira visita, e só fora
   * da janela. Quem fica no período normal não paga nada.
   */
  async function garantirMesCarregado(ano: number, mes: number) {
    const chave = `${ano}-${String(mes + 1).padStart(2, '0')}`;
    if (chave >= TX_WINDOW.from.slice(0, 7) && chave <= TX_WINDOW.to.slice(0, 7)) return;
    if (mesesExtras.current.has(chave)) return;
    mesesExtras.current.add(chave);

    const uid = await getUserId();
    if (!uid) return;

    const primeiro = `${chave}-01`;
    const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('transactions')
      .select(COLUNAS_TX)
      .eq('user_id', uid)
      .gte('date', primeiro)
      /* Ordem explícita e teto. São no máximo 31 dias de lançamentos, então
         mil linhas é folga enorme — o limite existe para o caso patológico
         (importação de fatura que deu errado) não travar a troca de mês. */
      .lte('date', ultimo)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGINA);

    // Falhou: tira da lista de carregados para tentar de novo na próxima
    // visita, em vez de fingir que o mês está vazio para sempre.
    if (error) { mesesExtras.current.delete(chave); return; }
    if (!data?.length) return;

    setAllTransactions(prev => {
      const vistos = new Set(prev.map(t => t.id));
      const novas = (data as any[]).filter(t => !vistos.has(t.id));
      return novas.length
        ? [...prev, ...novas].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
        : prev;
    });
  }

  const handlePrevMonth = () => {
    limparRecorte();
    const ano = activeMonth === 0 ? activeYear - 1 : activeYear;
    const mes = activeMonth === 0 ? 11 : activeMonth - 1;
    setActiveMonth(mes);
    setActiveYear(ano);
    void garantirMesCarregado(ano, mes);
  };
  const handleNextMonth = () => {
    limparRecorte();
    const ano = activeMonth === 11 ? activeYear + 1 : activeYear;
    const mes = activeMonth === 11 ? 0 : activeMonth + 1;
    setActiveMonth(mes);
    setActiveYear(ano);
    void garantirMesCarregado(ano, mes);
  };
  const handleOpenModal = () => setIsModalOpen(true);

  async function carregarPainel() {
    setErroCarregamento(null);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; return; }
      setUserEmail(session.user.email || "");
      setUserId(session.user.id);

      const [profileResponse, txResponse, walletsResponse, goalsResponse, positionsResponse, debtsResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        buscarTransacoesDaJanela(session.user.id),
        supabase.from('wallets').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA),
        supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA),
        supabase.from('investments').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA),
        supabase.from('debts').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA)
      ]);

      // As transações sustentam todo número desta tela. Sem elas não existe
      // painel para desenhar — existe um aviso honesto e um botão.
      //
      // O perfil de propósito NÃO entra nesta checagem: `.single()` devolve
      // erro para quem ainda não tem linha, e isso é o estado normal de uma
      // conta recém-criada. Tratá-lo como falha trancaria o usuário novo
      // para fora do app no primeiro acesso.
      if (txResponse.erro) {
        setErroCarregamento(txResponse.erro.message);
        return;
      }

      /* Teto de páginas atingido: há mais lançamentos do que trouxemos, e
         todo total desta tela sairia menor que o real. Avisar é a única
         saída honesta — um número incompleto apresentado como completo é
         pior que nenhum número. */
      if (txResponse.truncado) {
        toast("Você tem lançamentos demais no período para o app somar de uma vez. Os totais abaixo estão incompletos — use os relatórios por mês.", "warning");
      }

      setAllTransactions(txResponse.linhas);

      if (positionsResponse.data) setPositions(positionsResponse.data);
      if (debtsResponse.data) setDebts(debtsResponse.data);
      if (profileResponse.data) {
        setUserRole(profileResponse.data.role);
        setProfile(profileResponse.data as FinancialProfile);
      }
      if (walletsResponse.data) setWallets(walletsResponse.data);
      if (goalsResponse.data) setGoals(goalsResponse.data);

      // Os secundários não derrubam a tela, mas também não somem calados: o
      // painel abriria com carteira ou meta faltando e nada explicaria o
      // buraco.
      const secundariosComFalha = [
        walletsResponse.error && 'carteiras',
        goalsResponse.error && 'metas',
        positionsResponse.error && 'investimentos',
        debtsResponse.error && 'dívidas',
      ].filter(Boolean);

      if (secundariosComFalha.length > 0) {
        toast(`Não consegui carregar: ${secundariosComFalha.join(', ')}. O resto do painel está correto.`, "warning");
      }
    } catch (erro: any) {
      // Sem este catch, uma exceção deixava a tela no esqueleto para sempre,
      // porque o `setIsLoading(false)` ficava depois do ponto da falha.
      setErroCarregamento(erro?.message ?? 'Erro inesperado ao carregar seus dados.');
    } finally {
      setIsLoading(false);
    }
  }

  // Avisa a BottomNav para esconder o "+" enquanto a seleção está ligada: ele
  // ficaria sobre a barra de ações da seleção, na zona do polegar.
  // A emissão `false` na limpeza existe porque sair da Visão Geral com a
  // seleção ligada desmonta esta página sem passar por `setModoSelecao(false)`;
  // sem ela o "+" ficaria escondido nas outras rotas. A primeira emissão se
  // perde (o ouvinte da barra ainda não existe), e é inofensiva: o valor
  // inicial dos dois lados é `false`.
  useEffect(() => {
    const emitir = (ativo: boolean) =>
      window.dispatchEvent(new CustomEvent(EVENTO_MODO_SELECAO, { detail: { ativo } }));
    emitir(modoSelecao);
    return () => { emitir(false); };
  }, [modoSelecao]);

  useEffect(() => {
    // O service worker é registrado pelo InstallPrompt, que vive no layout e
    // portanto roda em todas as páginas.
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- Carga de dados
       ao abrir. A regra acusa a chamada abaixo porque o carregador acaba em
       setState; satisfazê-la exigiria uma biblioteca de busca (SWR, React
       Query) ou adiar o estado por microtask só para enganar o analisador.
       O custo real é um render a mais na abertura. Ver nota no PR. */
    carregarPainel();

    /**
     * Busca antes do toque os modais que a pessoa abre todo dia.
     *
     * Carregar os 25 sob demanda derrubou o painel de 211 kB para 27,8 kB,
     * mas transferiu o custo para o primeiro toque: no celular, "Lançar"
     * passou a esperar o download do pedaço antes de abrir. Esse atraso é o
     * que faz o app parecer lento mesmo estando leve.
     *
     * Aqui os quatro mais usados entram em cache enquanto a tela está parada,
     * depois que o painel já desenhou. O `import()` é o mesmo que o
     * `next/dynamic` usa, então o pedaço já está pronto quando o toque vem.
     */
    const aquecer = () => {
      void import("../components/TransactionModal");
      void import("../components/EditTransactionModal");
      void import("../components/PillarDetailModal");
      if (AI_ENABLED) void import("../components/AiUploadModal");
    };

    // `requestIdleCallback` não existe no Safari mais antigo.
    const ocioso = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(aquecer, { timeout: 3000 })
      : setTimeout(aquecer, 1500);

    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(ocioso);
      } else {
        clearTimeout(ocioso as any);
      }
    };
  }, []);

  // Recarrega apenas as transações e carteiras sem reload de página
  async function refreshTransactions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const [txResponse, walletsResponse, goalsResponse] = await Promise.all([
      buscarTransacoesDaJanela(session.user.id),
      supabase.from('wallets').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA),
      supabase.from('goals').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA)
    ]);

    // Esta função roda logo depois de salvar. Falhar calada aqui é pior que
    // na carga inicial: o lançamento FOI gravado, mas a lista não se atualiza
    // e a pessoa conclui que o salvamento não funcionou — então lança de novo
    // e fica com a despesa duplicada.
    if (txResponse.erro) {
      toast("Salvei, mas não consegui atualizar a lista. Puxe a tela para baixo ou recarregue — não lance de novo.", "warning");
      return;
    }

    setAllTransactions(txResponse.linhas);
    if (walletsResponse.data) setWallets(walletsResponse.data);
    if (goalsResponse.data) setGoals(goalsResponse.data);
  }

  // Recarrega só o perfil — usado após o onboarding, para o dashboard
  // recalibrar os limites sem recarregar a página inteira.
  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) {
      setUserRole(data.role);
      setProfile(data as FinancialProfile);
    }
  }

  // --- Reserva de Emergência (tabela goals) ---

  async function handleCreateReserveGoal(target: number) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.from('goals').insert([{
      user_id: session.user.id,
      title: 'Reserva de Emergência',
      target_amount: target,
      current_amount: 0,
    }]).select();

    if (error) {
      toast("Erro ao criar a meta: " + error.message, "error");
      return;
    }
    if (data) setGoals(prev => [...prev, ...data]);
    toast("🛡️ Reserva de Emergência criada. Agora é só alimentar.", "success");
  }

  /**
   * Guardar na reserva pelo "+" do card.
   *
   * Antes isto só somava em `goals.current_amount`. O dinheiro subia na
   * reserva sem sair da conta: o mesmo real aparecia como saldo disponível E
   * como reserva formada, e o saldo do mês nunca refletia o que foi guardado.
   *
   * Agora grava o par — a despesa, com `goal_id` apontando para a meta, e o
   * novo saldo dela. O `goal_id` é o que impede o patrimônio de contar esse
   * dinheiro duas vezes.
   */
  async function handleAddToReserve(value: number) {
    if (!reservaGoal) return;

    const uid = await getUserId();
    if (!uid) return;

    const r = moverNaMeta({
      userId: uid,
      goalId: reservaGoal.id,
      tituloDaMeta: reservaGoal.title ?? 'Reserva de Emergência',
      valor: value,
      sentido: 'guardar',
      saldoAtualDaMeta: Number(reservaGoal.current_amount ?? 0),
      data: hojeEmSaoPaulo(),
    });

    if (!r.ok) { toast(r.erro, "warning"); return; }

    const { data: nova, error } = await supabase
      .from('transactions')
      .insert([r.movimento.transacao])
      .select(COLUNAS_TX);

    if (error) { toast("Erro ao registrar o aporte: " + error.message, "error"); return; }

    const { error: erroMeta } = await supabase
      .from('goals')
      .update({ current_amount: r.movimento.novoSaldoDaMeta })
      .eq('id', reservaGoal.id);

    if (erroMeta) { toast("Erro ao atualizar a reserva: " + erroMeta.message, "error"); return; }

    if (nova?.length) setAllTransactions(prev => [...nova, ...prev]);
    setGoals(prev => prev.map(g => g.id === reservaGoal.id ? { ...g, current_amount: r.movimento.novoSaldoDaMeta } : g));
    toast(`+${formatMoney(value)} na sua reserva. 🛡️`, "success");
  }

  // Recarrega só as posições — usado quando o modal de Patrimônio salva, para
  // o estágio e o widget recalcularem sem buscar tudo de novo.
  async function refreshDebts() {
    const uid = await getUserId();
    if (!uid) return;
    const { data } = await supabase.from('debts').select('*').eq('user_id', uid).order('created_at', { ascending: true }).limit(PAGINA);
    if (data) setDebts(data);
    await refreshProfile();
  }

  async function refreshPositions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('investments').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(PAGINA);
    if (data) setPositions(data);
  }

  function handleOnboardingAction(step: StepId) {
    if (step === 'receita' || step === 'fixas') setIsModalOpen(true);
    if (step === 'dividas') setIsDebtsOpen(true);
    if (step === 'diagnostico') setIsRoadmapOpen(true);
  }

  /**
   * "Não tenho dívidas" grava no perfil, não só marca a lista.
   *
   * O mesmo `has_debt` que destrava este passo é o que prende o usuário no
   * Estágio 1 (Modo Emergência) e bloqueia a sugestão de aporte. Resolver só
   * na tela deixaria o app dizendo duas coisas diferentes sobre o mesmo fato.
   */
  async function handleOnboardingSkip(step: StepId) {
    if (step !== 'dividas') return;

    const uid = await getUserId();
    if (!uid) return;

    const { error } = await supabase.from('profiles').update({ has_debt: false }).eq('id', uid);
    if (error) { toast("Não consegui salvar: " + error.message, "error"); return; }

    await refreshProfile();
    toast("Anotado — sem dívidas. 👍", "success");
  }

  function handleEditTransaction(tx: any) {
    setEditingTransaction(tx);
    setIsEditModalOpen(true);
  }

  async function handleDeleteTransaction(id: string) {
    const tx = allTransactions.find(t => t.id === id);
    if (!tx) return;

    if (tx.installment_group) {
      const apagarSerie = await confirmDialog({
        title: 'Este lançamento se repete',
        message: 'Quer apagar esta parcela e todas as futuras, ou apenas esta?',
        confirmLabel: 'Esta e as futuras',
        cancelLabel: 'Apenas esta',
        danger: true,
      });

      if (apagarSerie) {
        // Guarda as linhas antes de apagar, para poder restaurar no desfazer.
        const removidas = allTransactions.filter(
          t => t.installment_group === tx.installment_group && t.date >= tx.date,
        );

        const { error } = await supabase.from('transactions').delete()
          .eq('installment_group', tx.installment_group)
          .gte('date', tx.date);

        if (error) { toast("Erro ao excluir série.", "error"); return; }

        setAllTransactions(prev => prev.filter(t => !(t.installment_group === tx.installment_group && t.date >= tx.date)));
        toastWithUndo(`${removidas.length} parcelas excluídas.`, async () => {
          const { error: undoError } = await supabase.from('transactions').insert(removidas);
          if (undoError) { toast("Não consegui desfazer.", "error"); return; }
          setAllTransactions(prev => [...prev, ...removidas].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
          toast("Parcelas restauradas.", "success");
        });
        return;
      }
    }

    /**
     * Veio de uma leitura por IA: oferece apagar a importação inteira.
     *
     * Uma fatura vira dezenas de linhas de uma vez. Sem isto, desfazer uma
     * leitura errada custa uma confirmação por compra. Fica depois da série
     * de parcelas porque importação não gera parcela — se um dia gerar, a
     * série é o recorte mais específico e deve ganhar.
     */
    if (tx.import_group) {
      const removidas = allTransactions.filter(t => t.import_group === tx.import_group);

      if (removidas.length > 1) {
        const apagarImportacao = await confirmDialog({
          title: 'Este veio de uma fatura lida',
          message: `A mesma leitura criou ${removidas.length} lançamentos. Quer apagar todos ou só este?`,
          confirmLabel: 'Apagar os ' + removidas.length,
          cancelLabel: 'Apenas este',
          danger: true,
        });

        if (apagarImportacao) {
          const { error } = await supabase.from('transactions').delete()
            .eq('import_group', tx.import_group);

          if (error) { toast("Erro ao excluir a importação.", "error"); return; }

          setAllTransactions(prev => prev.filter(t => t.import_group !== tx.import_group));
          toastWithUndo(`${removidas.length} lançamentos excluídos.`, async () => {
            const { error: undoError } = await supabase.from('transactions').insert(removidas);
            if (undoError) { toast("Não consegui desfazer.", "error"); return; }
            setAllTransactions(prev => [...prev, ...removidas].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
            toast("Importação restaurada.", "success");
          });
          return;
        }
      }
    }

    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { toast("Erro ao excluir.", "error"); return; }

    setAllTransactions(prev => prev.filter(t => t.id !== id));
    toastWithUndo("Lançamento excluído.", async () => {
      const { error: undoError } = await supabase.from('transactions').insert([tx]);
      if (undoError) { toast("Não consegui desfazer.", "error"); return; }
      setAllTransactions(prev => [...prev, tx].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
      toast("Lançamento restaurado.", "success");
    });
  }

  function sairDaSelecao() {
    setModoSelecao(false);
    setAcoesAbertas(null);
    setSelecionados([]);
  }

  function alternarSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  /**
   * Apaga vários de uma vez, com desfazer.
   *
   * Mesma mecânica da exclusão de série de parcelas: guarda as linhas antes,
   * apaga, e o desfazer reinsere. Sem o desfazer, um toque errado aqui apaga
   * dezenas de lançamentos de uma vez e não há volta.
   */
  async function handleDeleteSelecionados() {
    const removidas = allTransactions.filter(t => selecionados.includes(t.id));
    if (removidas.length === 0) return;

    const total = removidas.reduce((acc, t) => acc + (t.type === 'expense' ? t.amount : 0), 0);

    const confirmado = await confirmDialog({
      title: `Apagar ${removidas.length} ${removidas.length === 1 ? 'lançamento' : 'lançamentos'}?`,
      message: `Somam ${formatMoney(total)} em despesas. Dá para desfazer logo depois.`,
      confirmLabel: 'Apagar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!confirmado) return;

    const ids = removidas.map(t => t.id);
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { toast("Erro ao excluir os lançamentos.", "error"); return; }

    setAllTransactions(prev => prev.filter(t => !ids.includes(t.id)));
    sairDaSelecao();

    toastWithUndo(`${removidas.length} ${removidas.length === 1 ? 'lançamento excluído' : 'lançamentos excluídos'}.`, async () => {
      const { error: undoError } = await supabase.from('transactions').insert(removidas);
      if (undoError) { toast("Não consegui desfazer.", "error"); return; }
      setAllTransactions(prev => [...prev, ...removidas].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
      toast("Lançamentos restaurados.", "success");
    });
  }

  /**
   * Marcar pago — e, numa fatura, marcar a fatura inteira.
   *
   * Uma fatura de cartão é UM pagamento. Ninguém paga a Neon separado do
   * Fies: paga o total do cartão. Então "pago" é propriedade da fatura, não
   * da linha, e pedir um toque por compra em 34 compras é pedir 34 toques
   * para registrar um fato só.
   *
   * O RECORTE INCLUI A DATA, E ISSO É ESSENCIAL
   * As parcelas futuras projetadas na importação carregam o MESMO
   * `import_group` — elas nasceram da mesma leitura. Agrupar só por ele
   * marcaria como paga a parcela 5/10 que vence em março: a dívida futura
   * sumiria das contas a vencer e da previsão de caixa, sem aviso. Como toda
   * linha desta fatura compartilha a data da importação e as projetadas têm
   * datas à frente, somar a data ao recorte deixa cada uma no seu mês.
   *
   * SEM CONFIRMAÇÃO, COM DESFAZER
   * Diferente do apagar. A regra do app é confirmação para o que destrói e
   * desfazer para o que é reversível — e um diálogo a cada toque devolveria
   * o atrito que esta mudança existe para tirar.
   */
  async function handleTogglePaid(id: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    const tx = allTransactions.find(t => t.id === id);

    // A regra do recorte mora em lib/fatura.ts, com testes: errar nela
    // marcaria parcela futura como paga e sumiria com dívida em silêncio.
    const daFatura = linhasDaMesmaFatura(allTransactions, tx);

    if (daFatura.length > 1) {
      const ids = daFatura.map(t => t.id);
      // Guarda o estado de cada uma: a fatura pode estar meio marcada, e o
      // desfazer precisa devolver exatamente o que havia antes.
      const antes = daFatura.map(t => ({ id: t.id, is_paid: t.is_paid }));

      const { error } = await supabase.from('transactions').update({ is_paid: newStatus }).in('id', ids);
      if (error) { toast("Erro ao atualizar status.", "error"); return; }

      setAllTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_paid: newStatus } : t));

      toastWithUndo(
        `Fatura inteira: ${daFatura.length} lançamentos ${newStatus ? 'pagos' : 'pendentes'}.`,
        async () => {
          // Duas atualizações no máximo, agrupadas pelo valor anterior.
          const eramPagas = antes.filter(a => a.is_paid === true).map(a => a.id);
          const naoEram = antes.filter(a => a.is_paid !== true).map(a => a.id);

          const erros = await Promise.all([
            eramPagas.length
              ? supabase.from('transactions').update({ is_paid: true }).in('id', eramPagas)
              : Promise.resolve({ error: null }),
            naoEram.length
              ? supabase.from('transactions').update({ is_paid: false }).in('id', naoEram)
              : Promise.resolve({ error: null }),
          ]);

          if (erros.some(r => r.error)) { toast("Não consegui desfazer.", "error"); return; }

          const mapa = new Map(antes.map(a => [a.id, a.is_paid]));
          setAllTransactions(prev => prev.map(t => mapa.has(t.id) ? { ...t, is_paid: mapa.get(t.id) } : t));
          toast("Status restaurado.", "success");
        },
      );
      return;
    }

    const { error } = await supabase.from('transactions').update({ is_paid: newStatus }).eq('id', id);
    if (!error) {
      setAllTransactions(prev => prev.map(t => t.id === id ? { ...t, is_paid: newStatus } : t));
      toast(newStatus ? "Marcado como pago! ✅" : "Marcado como pendente.", "info");
    } else {
      toast("Erro ao atualizar status.", "error");
    }
  }

  /**
   * Daqui para baixo é tudo derivado — nada vem de estado próprio.
   *
   * Antes rodava a cada render: dez filtros, as somas, os insights e a
   * previsão. Como a busca é um `useState` neste mesmo componente, CADA TECLA
   * digitada refazia a cadeia inteira sobre todos os lançamentos. Era isso que
   * fazia o app parecer travado ao digitar ou ao abrir uma folha.
   *
   * As dependências são estreitas de propósito: `allTransactions` muda por
   * referência quando a lista muda, e mês e ano são números. Nada aqui depende
   * de busca, filtro de subcategoria ou modal aberto, que são os estados que
   * mudam o tempo todo.
   */
  const visibleTransactions = useMemo(
    () => (activeWalletId ? allTransactions.filter(t => t.wallet_id === activeWalletId) : allTransactions),
    [allTransactions, activeWalletId],
  );

  const currentMonthTransactions = useMemo(() => visibleTransactions.filter(t => {
    if (!t.date) return false;
    const [year, month] = t.date.split('-');
    // Filtra por mês E ano — corrige bug de parcelas de outros anos
    return (parseInt(month) - 1) === activeMonth && parseInt(year) === activeYear;
  }), [visibleTransactions, activeMonth, activeYear]);

  // Uma varredura só para o que antes eram seis.
  const doMes = useMemo(() => {
    let totalIncome = 0, totalExpense = 0;
    const contasFixas: any[] = [], variaveis: any[] = [], cartoes: any[] = [];
    const investimentos: any[] = [], receitasList: any[] = [];

    for (const t of currentMonthTransactions) {
      if (t.type === 'income') totalIncome += t.amount; else totalExpense += t.amount;

      const c = t.category;
      if (c === 'Contas Fixas') contasFixas.push(t);
      else if (c === 'Variáveis') variaveis.push(t);
      else if (c === 'Cartões' || c === 'Cartões de Crédito') cartoes.push(t);
      else if (c === 'Investimentos') investimentos.push(t);

      // Espelha a Renda Líquida: resgate de investimento não é receita do mês.
      // Ele já aparece no card de Investimentos, abatendo o patrimônio.
      if (t.type === 'income' && c !== 'Investimentos') receitasList.push(t);
    }

    return { totalIncome, totalExpense, contasFixas, variaveis, cartoes, investimentos, receitasList };
  }, [currentMonthTransactions]);

  const { totalIncome, totalExpense, contasFixas, variaveis, cartoes, investimentos, receitasList } = doMes;
  const balance = totalIncome - totalExpense;

  // Saída soma, entrada abate — vale para todas as categorias.
  // Investimentos tinha uma exceção que somava tudo, inclusive receitas: um
  // aporte de 500 e um resgate de 3.800 viravam 4.300, como se ambos fossem
  // dinheiro guardado. Com aporte lançado como despesa e resgate como receita,
  // a regra geral já dá o líquido correto e a exceção deixou de ser necessária.
  const sumCategory = (list: any[]) => list.reduce((acc, t) => {
    return acc + (t.type === 'expense' ? t.amount : -t.amount);
  }, 0);

  // --- Pilares do mês: visão de construção de patrimônio ---
  // Somas estritas por tipo/categoria (amount é sempre positivo no banco).
  // Não usam sumCategory de propósito: aqui queremos o gasto bruto do bloco,
  // sem o abatimento de receitas lançadas dentro da mesma categoria.
  const GARGALO_CATEGORIES = ['Variáveis', 'Cartões', 'Cartões de Crédito'];

  // Lista e total saem do MESMO filtro, de propósito.
  //
  // Clicar no card abre os lançamentos que formam aquele número, e a soma do
  // modal precisa bater com a do card até o centavo. Manter dois filtros
  // parecidos em pontos distantes do arquivo é exatamente como isso deixa de
  // bater: alguém ajusta uma categoria num lugar e esquece do outro.
  const expensesIn = (categories: string[]) => currentMonthTransactions
    .filter(t => t.type === 'expense' && categories.includes(t.category));

  const somar = (list: any[]) => list.reduce((acc, t) => acc + t.amount, 0);
  const sumExpenseIn = (categories: string[]) => somar(expensesIn(categories));

  const custosFixosList = expensesIn(['Contas Fixas']);
  const gargaloList = expensesIn(GARGALO_CATEGORIES);

  // Renda de trabalho: exclui Investimentos de propósito.
  // Venda/resgate de ativo é dinheiro mudando de bolso, não renda recorrente.
  // Se entrasse aqui, um mês bom de bolsa inflaria a renda e faria o consumo
  // no cartão parecer saudável — e o app elogiaria um gasto que não mudou.
  //
  // `receitasList` já é esse filtro, definido acima: reaproveitar evita uma
  // terceira cópia do mesmo predicado.
  const rendaLiquida = somar(receitasList);
  const custosFixos = somar(custosFixosList);
  const gastoCartoes = sumExpenseIn(['Cartões', 'Cartões de Crédito']);
  const gastoVariaveis = sumExpenseIn(['Variáveis']);
  const gargalo = somar(gargaloList);
  const capacidadePoupanca = rendaLiquida - custosFixos - gargalo;

  // % da renda comprometida com o gargalo (cartões + variáveis).
  // O valor bruto pode passar de 100%; o anel é limitado a 100 só no visual.
  const percentOf = (val: number) => rendaLiquida > 0 ? (val / rendaLiquida) * 100 : 0;
  const comprometimentoRaw = percentOf(gargalo);
  const comprometimentoPercent = Math.min(100, comprometimentoRaw);

  // Reserva de emergência atual (meta homônima na tabela goals).
  const reservaGoal = goals.find(g => g.title === 'Reserva de Emergência');
  const reservaAtual = Number(reservaGoal?.current_amount ?? 0);

  // Protocolo de perfil: os limites abaixo NÃO são constantes universais —
  // saem da estratégia e do tipo de renda declarados pelo usuário.
  //
  // É o cálculo mais caro da tela — varre todo o histórico para tirar medianas
  // por categoria e detectar cobrança recorrente. Rodava a cada render,
  // inclusive a cada tecla da busca.
  // Memoizado pela DATA, não pelo instante: assim o painel não recalcula a
  // cada render, mas vira de dia junto com o usuário.
  const hoje = hojeEmSaoPaulo();

  const insights = useMemo(() => getProfileInsights({
    hoje,
    profile,
    allTransactions,
    monthIncome: rendaLiquida,
    monthExpense: totalExpense,
    monthGargalo: gargalo,
    monthFixos: custosFixos,
    reserveAmount: reservaAtual,
    positions,
    debts,
  }), [hoje, profile, allTransactions, rendaLiquida, totalExpense, gargalo, custosFixos, reservaAtual, positions, debts]);

  const debtSummary = useMemo(() => summarizeDebts(debts as any), [debts]);
  const hasRegisteredDebts = useMemo(() => debts.some(d => (d.status ?? 'ativa') === 'ativa'), [debts]);


  // Semáforo de 3 faixas, com os cortes vindos do perfil.
  const gargaloTier = comprometimentoRaw > insights.gargaloCritical
    ? 'critico'
    : comprometimentoRaw > insights.gargaloWarn
      ? 'atencao'
      : 'saudavel';

  // Cor do modal de detalhe do gargalo. As cores do ALERTA moram em
  // `AlertaGargalo`, que é quem as desenha.
  const accentDoGargalo = { saudavel: 'padrao', atencao: 'amber', critico: 'rose' }[gargaloTier];

  // Título, lista e cor de cada item clicável da divisão da renda num lugar só.
  // A cor do gargalo acompanha o tier para o modal abrir na mesma cor do item
  // que foi tocado — abrir em cor diferente faz duvidar se é o mesmo número.
  //
  // `total` só existe onde a soma bruta da lista NÃO é o número do item: o
  // "já guardado" é líquido de resgates e o "livre" mistura entradas e saídas.
  // Nos dois o modal usa o valor exato da página em vez de recalcular.
  const PILARES: Record<IdDoSegmento, { title: string; subtitle: string; list: any[]; accent: string; total?: number }> = {
    fixos:    { title: 'Custos Fixos',        subtitle: 'o que você paga todo mês',            list: custosFixosList,          accent: 'blue' },
    gargalo:  { title: 'Cartões & Variáveis', subtitle: 'onde o dinheiro escapa',              list: gargaloList,              accent: accentDoGargalo },
    guardado: { title: 'Já guardado',         subtitle: 'aportes menos resgates do mês',       list: investimentos,            accent: 'padrao', total: sumCategory(investimentos) },
    livre:    { title: 'Livre na conta',      subtitle: 'tudo que entrou menos tudo que saiu', list: currentMonthTransactions, accent: 'padrao', total: balance },
  };
  const pilarAtivo = pilarAberto ? PILARES[pilarAberto] : null;

  const filteredTransactions = visibleTransactions.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPending = filterPending ? (t.is_paid === false && t.type === 'expense') : true;
    return matchesSearch && matchesPending;
  });

  // A lista precisa seguir o mês que está na tela. Antes ela mostrava os 8
  // últimos de TODA a janela (−18/+24 meses), enquanto cada card acima mostrava
  // só o mês selecionado — então "Custos Fixos R$ 0,00" aparecia logo acima de
  // uma conta de luz de outro mês, e o painel se contradizia sozinho.
  //
  // Busca e "A Vencer" continuam varrendo tudo de propósito: procurar um gasto
  // só dentro do mês aberto não acha nada. Quando isso acontece, a tela avisa.
  const buscaForaDoMes = Boolean(searchQuery || filterPending);
  const baseDaLista = buscaForaDoMes ? filteredTransactions : currentMonthTransactions;

  // Clicar num grupo do "Onde foi o dinheiro" abre as compras daquele grupo.
  // Sem isto, um grupo como "Outros" mostrava um total e nada mais — dava para
  // ver que havia 5 compras sem nome, e não dava para chegar até elas.
  const listaFiltrada = subcategoriaFiltro
    ? baseDaLista.filter(t =>
        t.type === 'expense' &&
        (normalizarSubcategoria(t.subcategoria) ?? NAO_CLASSIFICADO) === subcategoriaFiltro)
    : baseDaLista;

  // Uma fatura importada traz dezenas de linhas. Com o corte fixo em 8 e sem
  // "ver mais", o resto ficava inalcançável: só pela busca, e só sabendo o nome.
  const LIMITE_LISTA = 8;
  const recentTransactions = mostrarTodos ? listaFiltrada : listaFiltrada.slice(0, LIMITE_LISTA);
  const ocultos = listaFiltrada.length - recentTransactions.length;

  /**
   * "Ver onde cortar": rola até "Onde foi o dinheiro" e LEVA O FOCO junto.
   * Rolar sem mover o foco deixa quem usa teclado ou leitor de tela parado no
   * alerta, a uma tela de distância do conteúdo que acabou de pedir. O `h2` do
   * card tem `tabIndex={-1}`: é alvo de foco programático, não entra no Tab.
   */
  function irParaOndeFoi() {
    const destino = ondeFoiRef.current;
    if (!destino) return;
    const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView({ block: 'start', behavior: reduzMovimento ? 'auto' : 'smooth' });
    // `preventScroll`: a rolagem acima já é a que vale, e o foco não pode
    // cancelá-la nem duplicá-la.
    destino.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }

  function abrirGrupo(rotulo: string) {
    const mesmo = subcategoriaFiltro === rotulo;
    setSubcategoriaFiltro(mesmo ? null : rotulo);
    // Abrir um grupo e ainda esconder parte dele seria o mesmo problema de novo.
    setMostrarTodos(!mesmo);
    // Seleção feita no grupo anterior não pode sobreviver à troca: os itens
    // saem da tela e continuariam contando na exclusão.
    setSelecionados([]);
  }

  const variaveisPercent = rendaLiquida > 0 ? (sumCategory(variaveis) / rendaLiquida) * 100 : 0;

  /**
   * Dica do mês — uma frase, não um card.
   *
   * `null` quando não há nada relevante a dizer: encher a tela com
   * "continue acompanhando seus gastos" é ruído, não orientação.
   */
  const dicaDoMes: string | null = (() => {
    if (rendaLiquida === 0) return null;
    if (gargaloTier === 'critico') return null; // o termômetro já grita isso
    if (variaveisPercent > insights.gargaloWarn) {
      return `Seus gastos variáveis já consomem ${variaveisPercent.toFixed(0)}% da renda. É o ponto mais fácil de cortar este mês.`;
    }
    if (capacidadePoupanca > 0 && insights.shouldSuggestContribution && reservaAtual < insights.reserveMinimum) {
      return `Sobram ${formatMoney(capacidadePoupanca)} este mês. Guardar parte agora encurta o caminho até sua reserva.`;
    }
    if (balance < 0) return 'Você gastou mais do que ganhou neste mês. Vale revisar os lançamentos pendentes.';
    return null;
  })();

  /**
   * Só desenha os números quando eles são confiáveis.
   *
   * Sem isto, o caminho de erro mostraria o checklist de boas-vindas pedindo
   * "lance sua primeira receita" para alguém que tem anos de lançamentos e
   * só perdeu a conexão.
   */
  const pronto = !isLoading && !erroCarregamento;

  const todayStr = hojeEmSaoPaulo();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

  const dueBills = visibleTransactions.filter(t => {
    if (t.type !== 'expense' || t.is_paid) return false;
    return t.date <= threeDaysStr;
  });

  /**
   * O ponto vermelho do sino é DERIVADO, não sincronizado.
   *
   * Antes um efeito espelhava `dueBills.length > 0` para dentro de um
   * `hasUnread`, e abrir os avisos zerava o espelho. Dois problemas: um
   * render extra toda vez que a contagem mudava, e um estado que podia
   * discordar da lista que ele resume.
   *
   * Agora guardamos só o que o efeito não conseguia expressar — QUANTAS
   * contas havia quando a pessoa dispensou o aviso. O ponto reaparece
   * sozinho quando esse número muda, que é exatamente o que o efeito fazia
   * ao rodar de novo com `dueBills.length` diferente.
   */
  const hasUnread = dueBills.length > 0 && dispensadoCom !== dueBills.length;
  const dispensarAvisos = () => setDispensadoCom(dueBills.length);

  // No Estágio 1 a prioridade do card Jornada vira número (dívida cara e juros
  // por mês) ou um pedido de cadastro — os dois ramos que o card de estágio
  // antigo já tinha, agora calculados aqui e só desenhados lá.
  const dividaCaraNoEstagio1 = insights.stage.id === 'emergencia' && debtSummary.expensiveTotal > 0
    ? { total: debtSummary.expensiveTotal, jurosPorMes: debtSummary.expensiveMonthlyInterest }
    : undefined;
  const valoresDaRenda: Record<IdDoSegmento, number> = {
    fixos: custosFixos,
    gargalo,
    guardado: sumCategory(investimentos),
    livre: balance,
  };
  const divisaoDaRenda = dividirRenda({
    rendaLiquida,
    custosFixos,
    gargalo,
    guardado: valoresDaRenda.guardado,
    livre: balance,
  });

  const pedeCadastroDeDivida = insights.stage.id === 'emergencia' && !dividaCaraNoEstagio1
    && !hasRegisteredDebts && !!profile?.has_debt;

  return (
    <BetaGate>
    <div className="min-h-[100dvh] bg-canvas text-ink font-sans selection:bg-brand/30">
      
      <nav className="hidden md:flex border-b border-line-strong bg-white/5 backdrop-blur-md sticky top-0 z-50">
        {/* Mesma largura do conteúdo: com a barra em max-w-7xl e o conteúdo
            em 1120px, o logo não ficava alinhado com o primeiro card. */}
        <div className="mx-auto flex h-20 w-full max-w-[1120px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-field flex items-center justify-center shadow-lg shadow-brand/20 overflow-hidden bg-white/5">
              <Image src="/icon-192.png" alt="Logo" width={40} height={40} priority className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xl tracking-tight">Nexa</span>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={activeWalletId || ''} 
              onChange={(e) => setActiveWalletId(e.target.value || null)}
              className="bg-black/30 border border-line-strong text-ink text-sm rounded-lg py-1.5 px-3 focus:outline-none focus:border-brand hidden sm:block"
            >
              <option value="">Todas Carteiras</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button onClick={() => setIsWalletsOpen(true)} className="text-xs bg-brand/10 text-brand hover:bg-brand/20 px-2 py-1.5 rounded-lg font-medium transition-colors border border-brand/20 hidden sm:block">
              Carteiras
            </button>

            <button onClick={() => { setIsActivityOpen(true); dispensarAvisos(); }} className="text-ink-2 hover:text-ink transition-colors relative ml-2">
              <Bell className="w-5 h-5" />
              {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 bg-neg rounded-full animate-pulse"></span>}
            </button>
            <div onClick={() => setIsProfileOpen(true)} className={`w-9 h-9 border rounded-full flex items-center justify-center overflow-hidden cursor-pointer transition-colors ${userRole === 'admin' ? 'bg-brand/20 border-brand text-brand' : 'bg-white/5 border-line-strong text-ink-2 hover:border-pos'}`}>
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </nav>

      {/* Largura máxima de 1120px, o valor do sistema de design.
          Era `md:max-w-7xl` (1280px): numa tela larga o painel esticava até
          virar três colunas de cards muito afastadas, e o olho precisava
          atravessar a tela inteira para ligar um rótulo ao seu número —
          exatamente o que acontecia com "Saldo em conta". */}
      <main className="mx-auto max-w-md px-6 pt-safe py-8 md:max-w-[1120px] md:py-12">
        
        {/* No celular este é o ÚNICO cabeçalho: a saudação é a linha de apoio e
            o título da tela é "Visão geral", o `h1`. No desktop o `h1` é o da
            faixa abaixo, e este cabeçalho não aparece — sempre UM `h1`.
            O avatar decorativo saiu: não era botão, não dizia nada, e tomava
            ~40px de uma linha que precisa do espaço para os três alvos de 44px. */}
        <header className="mb-4 flex items-center justify-between gap-2 md:hidden">
          {/* `min-w-0`: texto não encolhe sozinho em flex. Sem `truncate` no
              título de propósito — se um dia faltar largura, ele quebra em duas
              linhas em vez de perder letras. */}
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-2">
              {nomeParaSaudacao ? `${saudacao()}, ${nomeParaSaudacao}` : saudacao()}
            </p>
            {/* 20px abaixo de 360px: "Visão geral" a 22px/700 mede ~120px e em
                320px sobram ~116px ao lado dos três alvos de 44px. A 20px
                (com o `tracking-tight`) são ~103px. Estimativa por métrica
                média da Inter, não medida em navegador. */}
            <h1 className="text-xl font-bold tracking-tight text-ink xs:text-[22px]">Visão geral</h1>
          </div>

          {/* Assinaturas e Conselheiro saíram daqui: ambos vivem no menu "Mais",
              e os ícones (lupa, alvo) não diziam o que abriam.
              44x44 nos três em TODA largura. Com o avatar fora, 3×44 + 2×8 =
              148px deixam 124px dos 272px internos de 320px — a regra de 36px
              abaixo de 360px, que existia por causa da saudação, não é mais
              necessária. */}
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setShowValues(!showValues)}
              aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/5 text-ink-2 transition-colors hover:text-ink"
            >
              {showValues ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            <button onClick={() => { setIsActivityOpen(true); dispensarAvisos(); }} aria-label="Avisos" className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/5 text-ink-2 transition-colors hover:text-ink">
              <Bell className="h-5 w-5" />
              {hasUnread && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-neg"></span>}
            </button>
            {/* Entrada do feedback abaixo de 1368px.
                O botão flutuante cobria o conteúdo nessas larguras (ver
                `FeedbackWidget`), então aqui ele deixa de pairar e passa a
                rolar com a página. O painel é o mesmo: este botão só dispara
                o evento que o widget escuta — não existe segundo formulário
                de feedback. */}
            <button
              onClick={abrirFeedback}
              aria-label={ROTULO_FEEDBACK}
              className="grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/5 text-ink-2 transition-colors hover:text-ink"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* UMA linha em toda largura, com as ações à direita.
            Era `flex-col xl:flex-row`, e isso dava duas regressões: no celular
            o menu "⋯" sobrava sozinho numa fileira inteira acima do primeiro
            card, e entre 768 e 1279px "Lançar"/"Ler Fatura" caíam numa linha
            própria esticados a meia largura cada. Agora o grupo da esquerda
            encolhe (`min-w-0 flex-1`) e o da direita acompanha o título. */}
        <div className="relative z-10 mb-6 flex min-w-0 items-center justify-between gap-3 md:mb-8 md:gap-6">
          {/* No celular isto era uma linha só, sem poder encolher: título +
              olho + seletor de mês passavam da largura da tela e empurravam a
              página inteira para o lado. O `flex-wrap` deixa o seletor descer
              quando não couber ao lado do título. */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 xl:flex-none">
            <div className="hidden min-w-0 flex-1 md:block xl:flex-none">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">Visão Geral</h1>
              <p className="text-ink-2 text-sm md:text-base">Acompanhe e gerencie seu patrimônio</p>
            </div>
            <button
              onClick={() => setShowValues(!showValues)}
              className="hidden h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-white/5 text-ink-2 transition-colors hover:bg-white/10 hover:text-ink md:grid"
              aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
              title={showValues ? "Ocultar valores" : "Mostrar valores"}
            >
              {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>

            {/* A MESMA entrada de feedback do cabeçalho do celular, para a
                faixa de 768px a 1191px.
                Aqui ela é obrigatória e não decorativa: o cabeçalho do celular
                é `md:hidden`, e o botão flutuante só volta em 1368px — sem
                este botão não haveria porta nenhuma para o feedback entre as
                duas larguras. Dispara o mesmo evento, abre o mesmo painel. */}
            <button
              onClick={abrirFeedback}
              className="hidden h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-line-strong bg-white/5 text-ink-2 transition-colors hover:bg-white/10 hover:text-ink md:max-gutter:grid"
              aria-label={ROTULO_FEEDBACK}
              title={ROTULO_FEEDBACK}
            >
              <MessageSquare className="h-5 w-5" />
            </button>

            {/* Seletor de mês global.
                Antes vivia dentro do cabeçalho da seção "Organização", no meio
                da página — o usuário trocava os quatro cards do topo sem
                perceber de onde vinha a mudança. Aqui ele fica junto do título,
                deixando claro que escopa tudo. */}
            {/* Abaixo de `md` é um trilho de 44px com setas de 44×44 (eram 28×28)
                e o rótulo em corpo de leitura; de `md` em diante continua a
                pílula compacta em caixa alta. O "⋯" ao lado já é `h-11 w-11`. */}
            <div className="flex h-11 w-full items-center justify-between rounded-field border border-line-strong bg-white/5 md:h-auto md:w-fit md:justify-start md:gap-1 md:rounded-full md:p-1">
              <button onClick={handlePrevMonth} aria-label="Mês anterior" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-field text-ink-2 transition-colors hover:text-ink md:h-auto md:w-auto md:rounded-full md:p-1.5"><ChevronLeft className="h-5 w-5 md:h-4 md:w-4" /></button>
              <div className="flex-1 text-center text-sm font-semibold text-ink md:w-32 md:flex-none md:text-xs md:font-medium md:uppercase md:tracking-wider">{MONTHS[activeMonth]} <span className="font-normal text-ink-3 md:font-medium">{activeYear}</span></div>
              <button onClick={handleNextMonth} aria-label="Próximo mês" className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-field text-ink-2 transition-colors hover:text-ink md:h-auto md:w-auto md:rounded-full md:p-1.5"><ChevronRight className="h-5 w-5 md:h-4 md:w-4" /></button>
            </div>
          </div>
          
          {/* Atalhos. Antes eram 11 chips coloridos em linha, que no desktop
              quebravam em três fileiras.

              NO CELULAR SOBRA SÓ O MENU. "Lançar" e "Ler Fatura" já são o "+"
              da barra inferior, no alcance do polegar: repetidas aqui, viravam
              quatro caminhos para dois destinos, e ainda disputavam os 312px
              de largura com o menu. O menu fica porque é a única porta para as
              outras catorze telas — e alinhado à direita, na mesma linha do
              seletor de mês, em vez de abrir uma fileira própria.

              Os botões têm a largura do CONTEÚDO (`shrink-0`, sem `flex-1`).
              Com `flex-1 basis-28` eles esticavam para meia largura cada entre
              768 e 1279px, virando dois blocos enormes numa linha só deles. */}
          <div className="flex shrink-0 items-center justify-end gap-2.5">
            {/* A ação principal do app é LANÇAR, não ler fatura.
                A hierarquia estava invertida: "Ler Fatura" tinha o tom de
                marca e a sombra, "Lançar" era a superfície apagada — ou seja,
                o atalho de um caso específico, que depende de a IA estar
                ligada, dominava o gesto que a pessoa repete todo dia. A troca
                é de ORDEM NO DOM também, e não de `order-*`: a ordem do foco
                por teclado tem que acompanhar a ordem visual. */}
            <motion.button onClick={handleOpenModal} className="hidden shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-brand px-5 py-2.5 font-semibold text-canvas shadow-[0_8px_28px_rgba(143,189,211,0.28)] transition-colors hover:bg-brand-strong active:scale-[0.97] cursor-pointer md:flex">
              <Plus className="w-4 h-4 shrink-0" /> <span className="text-sm">Lançar</span>
            </motion.button>

            {AI_ENABLED && (
              <motion.button onClick={() => setIsAiModalOpen(true)} className="hidden shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line bg-white/5 px-5 py-2.5 font-medium text-ink transition-colors hover:bg-white/10 active:scale-[0.97] cursor-pointer md:flex">
                {/* "Ler Foto" escondia o caso mais útil: ler uma fatura em PDF
                    e abrir compra por compra. */}
                <Sparkles className="w-4 h-4 shrink-0" /> <span className="text-sm">Ler Fatura</span>
              </motion.button>
            )}

            <div className="relative shrink-0">
              <button
                onClick={() => setIsMenuOpen(v => !v)}
                /* 44x44: estava em 40px (p-2.5 + ícone de 20), quatro abaixo
                   do mínimo do sistema, e é o botão que abre catorze telas. */
                className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full border transition-colors ${isMenuOpen ? 'border-line-strong bg-white/10 text-ink' : 'border-line-strong bg-white/5 text-ink-2 hover:text-ink'}`}
                title="Mais ferramentas"
                aria-label="Mais ferramentas"
                aria-expanded={isMenuOpen}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full z-50 mt-2 max-h-[70dvh] w-60 origin-top-right overflow-y-auto rounded-inner border border-line-strong bg-surface p-2 shadow-2xl scrollbar-hide"
                    >
                      {/* Catorze itens numa lista corrida viravam uma parede:
                          para achar "Previsão" era preciso ler os catorze.
                          Agrupados por intenção, a pessoa escolhe primeiro o
                          grupo — três opções — e só depois o item.

                          E o ícone volta a ser monocromático. Havia cinco
                          cores aqui (brand, warn, neg, pos, ink-2) distribuídas
                          sem critério: "Metas" em âmbar não significava alerta,
                          "Patrimônio" em verde não significava lucro. Cor que
                          não quer dizer nada ensina a ignorar a cor que quer —
                          e aí "Dívidas" em vermelho, que É um estado, se perde
                          no meio. Agora é a única colorida. */}
                      {[
                        {
                          grupo: 'Planejar',
                          itens: [
                            { label: 'Poupar',      icon: <PiggyBank className="h-4 w-4" />,          action: () => setIsPayYourselfOpen(true) },
                            { label: 'Orçamentos',  icon: <Wallet className="h-4 w-4" />,             action: () => setIsBudgetOpen(true) },
                            { label: 'Metas',       icon: <Target className="h-4 w-4" />,             action: () => setIsGoalsOpen(true) },
                            { label: 'Previsão',    icon: <CalendarClock className="h-4 w-4" />,      action: () => setIsForecastOpen(true) },
                            ...(AI_ENABLED ? [{ label: 'Conselheiro IA', icon: <Bot className="h-4 w-4" />, action: () => setIsPlannerOpen(true) }] : []),
                            { label: 'Perfil financeiro', icon: <SlidersHorizontal className="h-4 w-4" />, action: () => setIsProfileSettingsOpen(true) },
                          ],
                        },
                        {
                          grupo: 'Acompanhar',
                          itens: [
                            { label: 'Cartões',     icon: <CreditCard className="h-4 w-4" />,         action: () => setIsCardsOpen(true) },
                            { label: 'Relatórios',  icon: <PieChartIcon className="h-4 w-4" />,       action: () => setIsReportsOpen(true) },
                            { label: 'Raio-x dos gastos', icon: <PieChartIcon className="h-4 w-4" />, action: () => setIsSpendingOpen(true) },
                            { label: 'Calendário',  icon: <Calendar className="h-4 w-4" />,           action: () => setIsCalendarOpen(true) },
                            { label: 'Assinaturas', icon: <Clock className="h-4 w-4" />,              action: () => setIsTrackerOpen(true) },
                            { label: 'Casal',       icon: <Heart className="h-4 w-4" />,              action: () => setIsCoupleOpen(true) },
                          ],
                        },
                        {
                          grupo: 'Dívidas e patrimônio',
                          itens: [
                            // A única cor do menu. Dívida é estado, não assunto.
                            { label: 'Dívidas',     icon: <TrendingDown className="h-4 w-4" />, cor: 'text-neg', action: () => setIsDebtsOpen(true) },
                            { label: 'Patrimônio',  icon: <LineChart className="h-4 w-4" />,          action: () => setIsInvestmentsOpen(true) },
                          ],
                        },
                      ].map((secao, i) => (
                        <div key={secao.grupo} className={i > 0 ? 'mt-1 border-t border-line pt-1' : undefined}>
                          {/* 12px é o piso absoluto do sistema, e maiúsculas
                              ficam reservadas à navegação de mês e à etiqueta
                              de estágio — um título de grupo em caixa alta
                              seria o terceiro uso e tiraria o valor dos dois. */}
                          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-ink-3">
                            {secao.grupo}
                          </p>
                          {secao.itens.map(item => (
                            <button
                              key={item.label}
                              onClick={() => { setIsMenuOpen(false); item.action(); }}
                              className="flex w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2.5 text-left text-sm text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
                            >
                              <span className={'cor' in item && item.cor ? item.cor : 'text-ink-2'}>{item.icon}</span>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Com o onboarding pendente o card Jornada já é o convite; o checklist
            voltaria a pedir a mesma coisa duas vezes na mesma tela. */}
        {pronto && !insights.needsOnboarding && (
          <OnboardingChecklist
            transactions={allTransactions}
            hasDebtsRegistered={hasRegisteredDebts}
            declaredNoDebt={profile?.has_debt === false}
            onAction={handleOnboardingAction}
            onSecondaryAction={handleOnboardingSkip}
          />
        )}
        {isLoading ? (
          <EsqueletoVisaoGeral />
        ) : erroCarregamento ? (
          <div className="pb-6 md:pb-8">
            <div className="bg-warn/5 border border-warn/25 rounded-card p-6 md:p-8 text-center">
              <div className="w-12 h-12 bg-warn/10 border border-warn/20 rounded-inner flex items-center justify-center mx-auto mb-5">
                <WifiOff className="w-6 h-6 text-warn" />
              </div>

              <h2 className="text-lg font-bold text-ink mb-2">Não consegui carregar seus lançamentos</h2>
              <p className="text-sm text-ink-2 leading-relaxed max-w-md mx-auto">
                Seus dados estão salvos e intactos — o que falhou foi a leitura
                agora. Nenhum número apareceria correto nesta tela, então
                preferi não mostrar nenhum.
              </p>

              <button
                onClick={carregarPainel}
                className="mt-6 bg-brand text-canvas font-bold py-3 px-6 rounded-field hover:bg-brand-strong transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar de novo
              </button>

              <p className="text-xs text-ink-3 mt-5 break-words max-w-md mx-auto">
                Detalhe técnico: {erroCarregamento}
              </p>
            </div>
          </div>
        ) : null}

        {/* Jornada: o estágio, a escada e o próximo passo. Substituiu o card de
            estágio e a `ReserveWidget` — o "próximo passo" é o alvo do degrau
            atual, e o ideal segue visível no mapa do caminho e em Metas. */}
        {pronto && (
          <JornadaCard
            stage={insights.stage}
            degraus={getStageLadder(insights)}
            proximoPasso={getProximoPasso(insights)}
            needsOnboarding={insights.needsOnboarding}
            temMeta={!!reservaGoal}
            showValues={showValues}
            reserveMonths={insights.reserveMonths}
            dividaCara={dividaCaraNoEstagio1}
            pedeCadastroDeDivida={pedeCadastroDeDivida}
            onVerCaminho={() => setIsRoadmapOpen(true)}
            onResponderPerguntas={() => setIsProfileSettingsOpen(true)}
            onGuardar={handleAddToReserve}
            onCriarReserva={insights.reserveIdeal > 0 ? () => handleCreateReserveGoal(insights.reserveIdeal) : undefined}
          />
        )}

          {/* A "Dica do Nexa" vivia num card próprio, na coluna da direita.
              Ela e a faixa de estágio respondiam a mesma pergunta — "o que
              fazer agora" — em dois lugares distantes. Virou uma linha sob o
              estágio, e só aparece quando tem algo concreto a dizer. */}
          {pronto && !insights.needsOnboarding && dicaDoMes && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="-mt-4 mb-6 flex items-start gap-2 px-5 text-xs leading-relaxed text-ink-3"
            >
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-3" />
              {dicaDoMes}
            </motion.p>
          )}

        {pronto && (
          <CardQuantoSobra
            mes={MONTHS[activeMonth].toLowerCase()}
            sobra={capacidadePoupanca}
            rendaLiquida={rendaLiquida}
            divisao={divisaoDaRenda}
            valores={valoresDaRenda}
            showValues={showValues}
            onAbrirRenda={() => setIsIncomeModalOpen(true)}
            onAbrirSegmento={setPilarAberto}
            onLancarRenda={handleOpenModal}
            onLerFatura={() => setIsAiModalOpen(true)}
          />
        )}

        {/* Só com algo a dizer: teto passado, gasto real e renda para comparar.
            Sem renda o percentual não existe, e "saudável" não é alerta. */}
        {pronto && gargaloTier !== 'saudavel' && gargalo > 0 && rendaLiquida > 0 && (
          <AlertaGargalo
            tier={gargaloTier}
            percentual={comprometimentoRaw}
            showValues={showValues}
            onVerOndeCortar={irParaOndeFoi}
          />
        )}


        {/* Organização saiu da home: os 4 cards listavam cada lançamento e
            ocupavam meia tela repetindo o que o "Raio-x dos gastos" já faz
            melhor, comparando cada categoria com a própria mediana. */}
        <div className="flex flex-col gap-8">

          {/* `empty:hidden`: o card devolve `null` num mês sem despesa, e um
              contêiner vazio ainda gastaria um `gap-8` do flex. `md:scroll-mt-24`
              desconta a barra superior (h-20) que é `sticky` no desktop. */}
          <div ref={ondeFoiRef} id="onde-foi-o-dinheiro" className="scroll-mt-4 empty:hidden md:scroll-mt-24">
            {pronto && <ResumoOndeFoi transactions={currentMonthTransactions} showValues={showValues} onImportar={() => setIsAiModalOpen(true)} onSelecionar={abrirGrupo} filtroAtivo={subcategoriaFiltro} />}
          </div>

          {/* Com erro de carga a lista não existe: um "Nenhum lançamento" aqui
              diria "você não tem nada" justamente quando não se conseguiu ler. */}
          {!erroCarregamento && (
          <div className="w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="card h-full p-5">
              <div className="flex flex-col gap-4 mb-6">
                {/* "Ver tudo", "A vencer" e "Selecionar" ficam todos aqui, e o
                    `flex-wrap` deixa o grupo descer para uma segunda linha em
                    320px em vez de espremer o título. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <h2 className="text-base font-semibold tracking-tight text-ink">
                    {buscaForaDoMes ? 'Resultados' : `Lançamentos de ${MONTHS[activeMonth]}`}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2">
                    {buscaForaDoMes && !modoSelecao && (
                      <span className="text-xs text-ink-3">de todos os meses</span>
                    )}
                    {/* "Ver tudo" no cabeçalho, como na referência. Antes o
                        único caminho para o resto da lista era um botão no
                        fim dela — ou seja, depois de rolar os oito. */}
                    {ocultos > 0 && !modoSelecao && (
                      <button
                        onClick={() => setMostrarTodos(true)}
                        className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-field px-2 text-xs font-medium text-ink-2 transition-colors hover:text-ink"
                      >
                        Ver tudo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFilterPending(!filterPending)}
                      aria-pressed={filterPending}
                      className={`min-h-9 cursor-pointer whitespace-nowrap rounded-field border px-3 text-xs font-medium transition-colors ${filterPending ? 'bg-warn/15 text-warn border-warn/30' : 'border-line bg-white/5 text-ink-2 hover:text-ink'}`}
                    >
                      A vencer
                    </button>
                    {recentTransactions.length > 0 && (
                      <button
                        onClick={() => { if (modoSelecao) { sairDaSelecao(); } else { setAcoesAbertas(null); setModoSelecao(true); } }}
                        className={`min-h-9 cursor-pointer whitespace-nowrap rounded-field border px-3 text-xs font-medium transition-colors ${modoSelecao ? 'bg-brand/15 text-brand border-brand/30' : 'border-line bg-white/5 text-ink-2 hover:text-ink'}`}
                      >
                        {modoSelecao ? 'Cancelar' : 'Selecionar'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Região viva sempre montada e vazia: uma região criada junto com
                    o texto não é anunciada. Não cita o "+" — do `md:` em diante a
                    barra não existe e o aviso seria falso. */}
                <p role="status" className="sr-only">{modoSelecao ? 'Modo de seleção ligado. Toque em Cancelar para sair.' : ''}</p>

                {modoSelecao && (
                  <div className="flex flex-wrap items-center gap-2 -mt-1">
                    <button
                      onClick={() => setSelecionados(recentTransactions.map(t => t.id))}
                      className="text-xs font-medium text-brand hover:text-ink cursor-pointer"
                    >
                      Marcar os {recentTransactions.length} visíveis
                    </button>
                    {selecionados.length > 0 && (
                      <>
                        <span className="text-ink-3">·</span>
                        <button
                          onClick={() => setSelecionados([])}
                          className="text-xs font-medium text-ink-2 hover:text-ink cursor-pointer"
                        >
                          Limpar seleção
                        </button>
                      </>
                    )}
                  </div>
                )}

                {subcategoriaFiltro && (
                  <div className="flex items-center gap-2 -mt-1">
                    <span className="text-xs text-ink-3">Mostrando apenas</span>
                    <button
                      onClick={() => { setSubcategoriaFiltro(null); setMostrarTodos(false); }}
                      className="inline-flex items-center gap-1.5 bg-brand/15 text-brand border border-brand/30 px-2.5 py-1 rounded-full text-xs font-medium hover:bg-brand/25 transition-colors cursor-pointer"
                    >
                      {subcategoriaFiltro}
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-ink-3">
                      {listaFiltrada.length} {listaFiltrada.length === 1 ? 'compra' : 'compras'}
                    </span>
                  </div>
                )}
                <div className="relative">
                  <label htmlFor={idBusca} className="sr-only">Buscar lançamentos</label>
                  <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                  <input id={idBusca} type="text" placeholder="Buscar lançamentos" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-line rounded-field py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand/60 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                {isLoading ? (
                  <div aria-hidden>
                    {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
                  </div>
                ) : recentTransactions.length === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-6 w-6" />}
                    title={subcategoriaFiltro
                      ? `Nenhuma compra em ${subcategoriaFiltro} aqui.`
                      : buscaForaDoMes
                        ? "Nada encontrado com esse filtro."
                        : `Nenhum lançamento em ${MONTHS[activeMonth]}.`}
                    description={subcategoriaFiltro || buscaForaDoMes
                      ? undefined
                      : "Lance uma conta ou leia a fatura do cartão para começar o mês."}
                    action={subcategoriaFiltro || buscaForaDoMes
                      ? undefined
                      : { label: "Lançar", onClick: handleOpenModal }}
                  />
                ) : (
                  /* Um grupo por dia, cada um com o próprio `h3` e uma lista de
                     verdade: o leitor de tela anuncia "lista, 4 itens" e o dia
                     vem do cabeçalho, não de cada linha. O ano só aparece
                     quando a busca atravessa meses. Sem `sticky` nesta rodada. */
                  agruparPorDia(recentTransactions).map((grupo) => (
                    <div key={grupo.dia || 'sem-data'} className="mt-3 first:mt-0">
                      <h3 className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-2">
                        {rotuloDoDia(grupo.dia, { comAno: buscaForaDoMes })}
                      </h3>
                      <ul className="flex flex-col gap-0.5">
                        {grupo.itens.map((tx) => (
                          <li key={tx.id}>
                            <TransactionRow title={tx.title} category={tx.category} amount={tx.amount} visible={showValues} type={tx.type} isPaid={tx.is_paid} onTogglePaid={() => handleTogglePaid(tx.id, tx.is_paid)} onDelete={() => { setAcoesAbertas(null); handleDeleteTransaction(tx.id); }} onEdit={() => { setAcoesAbertas(null); handleEditTransaction(tx); }} receiptUrl={tx.receipt_url} subcategoria={tx.subcategoria} modoSelecao={modoSelecao} selecionado={selecionados.includes(tx.id)} onToggleSelecao={() => alternarSelecionado(tx.id)} acoesVisiveis={!!acoesAbertas && acoesAbertas.id === tx.id && acoesAbertas.recorte === recorteAtual} onAlternarAcoes={() => setAcoesAbertas(atual => atual?.id === tx.id ? null : { id: tx.id, recorte: recorteAtual })} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
                {/* Mesma medida do `pb-bottom-nav` (globals.css): a BottomNav é `fixed`
                    e esta barra é `sticky`, que se ancora na viewport, então o
                    espaçador do ChromeDoApp não a protege. Não virou token
                    porque `pb-bottom-nav` é o respiro de rodapé do app inteiro
                    e continua como está. Do `md` em diante a BottomNav some. */}
                {modoSelecao && selecionados.length > 0 && (
                  <div className="sticky bottom-[calc(7rem+env(safe-area-inset-bottom,0px))] md:bottom-2 z-10 flex items-center justify-between gap-3 bg-surface/95 backdrop-blur-xl border border-brand/30 rounded-inner p-3 shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {selecionados.length} {selecionados.length === 1 ? 'selecionado' : 'selecionados'}
                      </p>
                      <p className="text-xs text-ink-2 truncate">
                        {formatMoney(
                          allTransactions
                            .filter(t => selecionados.includes(t.id) && t.type === 'expense')
                            .reduce((acc, t) => acc + t.amount, 0),
                          showValues,
                        )} em despesas
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteSelecionados}
                      className="shrink-0 inline-flex min-h-11 items-center gap-2 bg-neg/15 hover:bg-neg/25 text-neg border border-neg/30 px-4 py-2.5 rounded-field text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Apagar
                    </button>
                  </div>
                )}

                {ocultos > 0 && (
                  <button
                    onClick={() => setMostrarTodos(true)}
                    className="w-full py-3 rounded-inner border border-line-strong bg-white/5 text-sm font-semibold text-ink-2 hover:bg-white/5 hover:text-ink transition-colors cursor-pointer"
                  >
                    Ver mais {ocultos} {ocultos === 1 ? 'lançamento' : 'lançamentos'}
                  </button>
                )}

                {mostrarTodos && listaFiltrada.length > LIMITE_LISTA && (
                  <button
                    onClick={() => setMostrarTodos(false)}
                    className="w-full py-2.5 text-xs font-medium text-ink-3 hover:text-ink-2 transition-colors cursor-pointer"
                  >
                    Mostrar menos
                  </button>
                )}
              </div>
            </motion.div>
          </div>
          )}

        </div>
      </main>

      <TransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={refreshTransactions} onImportarFatura={() => { setIsModalOpen(false); setIsAiModalOpen(true); }} />
      <EditTransactionModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} transaction={editingTransaction} onSave={refreshTransactions} />
      <IncomeListModal isOpen={isIncomeModalOpen} onClose={() => setIsIncomeModalOpen(false)} incomes={receitasList} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction} onTogglePaid={handleTogglePaid} formatMoney={formatMoney} />
      {pilarAtivo && (
        <PillarDetailModal
          isOpen
          onClose={() => setPilarAberto(null)}
          title={pilarAtivo.title}
          subtitle={pilarAtivo.subtitle}
          transactions={pilarAtivo.list}
          accent={pilarAtivo.accent}
          total={pilarAtivo.total}
          showValues={showValues}
          /* A lista fica aberta atrás da edição: ao salvar, o valor corrigido
             aparece aqui mesmo e o total do topo se recalcula, sem precisar
             reabrir o card. */
          onEdit={handleEditTransaction}
        />
      )}
      <AiUploadModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
      <AdvisorModal
        isOpen={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        currentIncome={rendaLiquida}
        currentExpense={totalExpense}
        balance={balance}
        transactions={currentMonthTransactions}
        insights={insights}
        strategyId={profile?.strategy}
        allTransactions={allTransactions}
        debts={debts as any}
        activeMonth={activeMonth}
        activeYear={activeYear}
        incomeType={profile?.income_type}
        periodKey={`${activeYear}-${activeMonth}`}
      />
      <SubscriptionTrackerModal isOpen={isTrackerOpen} onClose={() => setIsTrackerOpen(false)} transactions={allTransactions} />
      <ReportsModal isOpen={isReportsOpen} onClose={() => setIsReportsOpen(false)} transactions={currentMonthTransactions} allTransactions={allTransactions} activeMonth={activeMonth} activeYear={activeYear} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth} />
      <ActivityModal isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} transactions={allTransactions} dueBills={dueBills} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} userEmail={userEmail} userRole={userRole} />
      <CoupleModal isOpen={isCoupleOpen} onClose={() => setIsCoupleOpen(false)} />
      <GoalsModal isOpen={isGoalsOpen} onClose={() => setIsGoalsOpen(false)} onSaved={refreshTransactions} />
      <CategoryManagerModal isOpen={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} />
      <WalletsModal isOpen={isWalletsOpen} onClose={() => setIsWalletsOpen(false)} userId={userId} />
      <FinancialCalendarModal isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} transactions={allTransactions} />

      <BudgetModal isOpen={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} transactions={allTransactions} currentIncome={rendaLiquida} activeMonth={activeMonth} activeYear={activeYear} />
      <StageRoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
        insights={insights}
        showValues={showValues}
        onEditProfile={() => { setIsRoadmapOpen(false); setIsProfileSettingsOpen(true); }}
      />
      <ForecastModal
        isOpen={isForecastOpen}
        onClose={() => setIsForecastOpen(false)}
        allTransactions={allTransactions}
        insights={insights}
        activeMonth={activeMonth}
        activeYear={activeYear}
        showValues={showValues}
      />
      <SpendingInsightsModal
        isOpen={isSpendingOpen}
        onClose={() => setIsSpendingOpen(false)}
        monthTransactions={currentMonthTransactions}
        allTransactions={allTransactions}
        activeMonth={activeMonth}
        activeYear={activeYear}
        income={rendaLiquida}
        showValues={showValues}
      />
      <DebtsModal
        isOpen={isDebtsOpen}
        onClose={() => setIsDebtsOpen(false)}
        userId={userId}
        showValues={showValues}
        monthlyBudgetHint={Math.max(0, capacidadePoupanca)}
        onSave={refreshDebts}
      />
      <InvestmentsModal
        isOpen={isInvestmentsOpen}
        onClose={() => setIsInvestmentsOpen(false)}
        userId={userId}
        showValues={showValues}
        onSave={refreshPositions}
      />
      {isProfileSettingsOpen && (
        <ProfileSettingsModal
          isOpen={isProfileSettingsOpen}
          onClose={() => setIsProfileSettingsOpen(false)}
          profile={profile}
          userId={userId}
          onSave={refreshProfile}
        />
      )}
      <CreditCardManagerModal
        isOpen={isCardsOpen}
        onClose={() => setIsCardsOpen(false)}
        transactions={allTransactions}
        activeMonth={activeMonth}
        activeYear={activeYear}
        insights={insights}
        showValues={showValues}
        onTogglePaid={handleTogglePaid}
        onDelete={handleDeleteTransaction}
      />
      <PayYourselfFirstModal
        isOpen={isPayYourselfOpen}
        onClose={() => setIsPayYourselfOpen(false)}
        onSave={refreshTransactions}
        insights={insights}
      />
      <WelcomeModal
        isOpen={pronto && insights.needsOnboarding && !!userId}
        userId={userId}
        suggestedIncome={insights.referenceIncome}
        onComplete={refreshProfile}
      />
    </div>
    </BetaGate>
  );
}

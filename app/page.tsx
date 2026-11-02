"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wallet, TrendingUp, TrendingDown,
  Bell, User, Plus, Home as HomeIcon, CreditCard, 
  ChevronLeft, ChevronRight, Sparkles, LineChart, Target,
  PieChart as PieChartIcon, Search, Trash2, Heart, CheckCircle2, Clock, Edit2, Calendar, FileText, Eye, EyeOff,
  PiggyBank, ShieldCheck, Loader2, MoreHorizontal, Bot, SlidersHorizontal, CalendarClock,
  WifiOff, RefreshCw, X
} from "lucide-react";

import { TransactionModal } from "../components/TransactionModal";
import { EditTransactionModal } from "../components/EditTransactionModal";
import { IncomeListModal } from "../components/IncomeListModal";
import { AiUploadModal } from "../components/AiUploadModal";
import { AdvisorModal } from "../components/AdvisorModal";
import { SubscriptionTrackerModal } from "../components/SubscriptionTrackerModal";
import { ReportsModal } from "../components/ReportsModal";
import { ActivityModal } from "../components/ActivityModal";
import { ProfileModal } from "../components/ProfileModal";
import { CoupleModal } from "../components/CoupleModal";
import { FinancialCalendarModal } from "../components/FinancialCalendarModal";
import { WalletsModal } from "../components/WalletsModal";

import { BudgetModal } from "../components/BudgetModal";
import { WelcomeModal } from "../components/WelcomeModal";
import { GoalsModal } from "../components/GoalsModal";
import { CategoryManagerModal } from "../components/CategoryManagerModal";
import { PayYourselfFirstModal } from "../components/PayYourselfFirstModal";
import { CreditCardManagerModal } from "../components/CreditCardManagerModal";
import { StageRoadmapModal } from "../components/StageRoadmapModal";
import { PillarDetailModal } from "../components/PillarDetailModal";
import { DebtsModal } from "../components/DebtsModal";
import { SpendingInsightsModal } from "../components/SpendingInsightsModal";
import { ForecastModal } from "../components/ForecastModal";
import { ProfileSettingsModal } from "../components/ProfileSettingsModal";
import { InvestmentsModal } from "../components/InvestmentsModal";
import { supabase } from "../lib/supabase";
import { toast, toastWithUndo } from "../components/Toast";
import { confirmDialog } from "../components/ConfirmDialog";
import { getProfileInsights, type FinancialProfile } from "../lib/profile";
import { AI_ENABLED } from "../lib/features";
import { formatMoney } from "../lib/format";
import { getReceiptUrl } from "../lib/receipts";
import { resumoPorSubcategoria, normalizarSubcategoria, NAO_CLASSIFICADO } from "../lib/subcategorias";
import { getUserId } from "../lib/session";
import { summarizeDebts } from "../lib/debt";
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
const TX_WINDOW = (() => {
  const from = new Date();
  from.setMonth(from.getMonth() - 18);
  const to = new Date();
  to.setMonth(to.getMonth() + 24);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
})();

export default function Dashboard() {
  const [activeMonth, setActiveMonth] = useState(new Date().getMonth());
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [showValues, setShowValues] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  // Qual card do topo teve os lançamentos abertos.
  const [pilarAberto, setPilarAberto] = useState<null | 'renda' | 'fixos' | 'gargalo'>(null);
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

  const [hasUnread, setHasUnread] = useState(true);
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
  const [goals, setGoals] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPending, setFilterPending] = useState(false);
  /** Grupo de "Onde foi o dinheiro" aberto na lista. Null = sem filtro. */
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<string | null>(null);
  /** A lista mostra 8 por padrão. Uma fatura importada traz dezenas. */
  const [mostrarTodos, setMostrarTodos] = useState(false);
  
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // O grupo aberto é do mês que estava na tela. Carregá-lo para o mês seguinte
  // mostraria uma lista vazia com um filtro que a pessoa não escolheu ali.
  const limparRecorte = () => {
    setSubcategoriaFiltro(null);
    setMostrarTodos(false);
  };

  const handlePrevMonth = () => {
    limparRecorte();
    if (activeMonth === 0) {
      setActiveMonth(11);
      setActiveYear(prev => prev - 1);
    } else {
      setActiveMonth(prev => prev - 1);
    }
  };
  const handleNextMonth = () => {
    limparRecorte();
    if (activeMonth === 11) {
      setActiveMonth(0);
      setActiveYear(prev => prev + 1);
    } else {
      setActiveMonth(prev => prev + 1);
    }
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
        supabase.from('transactions').select('*').eq('user_id', session.user.id).gte('date', TX_WINDOW.from).lte('date', TX_WINDOW.to).order('date', { ascending: false }),
        supabase.from('wallets').select('*').eq('user_id', session.user.id),
        supabase.from('goals').select('*').eq('user_id', session.user.id),
        supabase.from('investments').select('*').eq('user_id', session.user.id),
        supabase.from('debts').select('*').eq('user_id', session.user.id)
      ]);

      // As transações sustentam todo número desta tela. Sem elas não existe
      // painel para desenhar — existe um aviso honesto e um botão.
      //
      // O perfil de propósito NÃO entra nesta checagem: `.single()` devolve
      // erro para quem ainda não tem linha, e isso é o estado normal de uma
      // conta recém-criada. Tratá-lo como falha trancaria o usuário novo
      // para fora do app no primeiro acesso.
      if (txResponse.error) {
        setErroCarregamento(txResponse.error.message);
        return;
      }

      setAllTransactions(txResponse.data ?? []);

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

  useEffect(() => {
    // O service worker é registrado pelo InstallPrompt, que vive no layout e
    // portanto roda em todas as páginas.
    carregarPainel();
  }, []);

  // Recarrega apenas as transações e carteiras sem reload de página
  async function refreshTransactions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const [txResponse, walletsResponse, goalsResponse] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', session.user.id).gte('date', TX_WINDOW.from).lte('date', TX_WINDOW.to).order('date', { ascending: false }),
      supabase.from('wallets').select('*').eq('user_id', session.user.id),
      supabase.from('goals').select('*').eq('user_id', session.user.id)
    ]);

    // Esta função roda logo depois de salvar. Falhar calada aqui é pior que
    // na carga inicial: o lançamento FOI gravado, mas a lista não se atualiza
    // e a pessoa conclui que o salvamento não funcionou — então lança de novo
    // e fica com a despesa duplicada.
    if (txResponse.error) {
      toast("Salvei, mas não consegui atualizar a lista. Puxe a tela para baixo ou recarregue — não lance de novo.", "warning");
      return;
    }

    setAllTransactions(txResponse.data ?? []);
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

  async function handleAddToReserve(value: number) {
    if (!reservaGoal) return;
    const novoValor = Number(reservaGoal.current_amount ?? 0) + value;

    const { error } = await supabase
      .from('goals')
      .update({ current_amount: novoValor })
      .eq('id', reservaGoal.id);

    if (error) {
      toast("Erro ao atualizar a reserva: " + error.message, "error");
      return;
    }
    setGoals(prev => prev.map(g => g.id === reservaGoal.id ? { ...g, current_amount: novoValor } : g));
    toast(`+${formatMoney(value)} na sua reserva. 🛡️`, "success");
  }

  // Recarrega só as posições — usado quando o modal de Patrimônio salva, para
  // o estágio e o widget recalcularem sem buscar tudo de novo.
  async function refreshDebts() {
    const uid = await getUserId();
    if (!uid) return;
    const { data } = await supabase.from('debts').select('*').eq('user_id', uid);
    if (data) setDebts(data);
    await refreshProfile();
  }

  async function refreshPositions() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('investments').select('*').eq('user_id', session.user.id);
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

  async function handleTogglePaid(id: string, currentStatus: boolean) {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('transactions').update({ is_paid: newStatus }).eq('id', id);
    if (!error) {
      setAllTransactions(prev => allTransactions.map(t => t.id === id ? { ...t, is_paid: newStatus } : t));
      toast(newStatus ? "Marcado como pago! ✅" : "Marcado como pendente.", "info");
    } else {
      toast("Erro ao atualizar status.", "error");
    }
  }

  const visibleTransactions = activeWalletId ? allTransactions.filter(t => t.wallet_id === activeWalletId) : allTransactions;

  const currentMonthTransactions = visibleTransactions.filter(t => {
    if (!t.date) return false;
    const [year, month] = t.date.split('-');
    // Filtra por mês E ano — corrige bug de parcelas de outros anos
    return (parseInt(month) - 1) === activeMonth && parseInt(year) === activeYear;
  });

  const totalIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  const contasFixas = currentMonthTransactions.filter(t => t.category === 'Contas Fixas');
  const variaveis = currentMonthTransactions.filter(t => t.category === 'Variáveis');
  const cartoes = currentMonthTransactions.filter(t => (t.category === 'Cartões' || t.category === 'Cartões de Crédito'));
  const investimentos = currentMonthTransactions.filter(t => t.category === 'Investimentos');
  // Espelha a Renda Líquida: resgate de investimento não é receita do mês.
  // Ele já aparece no card de Investimentos, abatendo o patrimônio.
  const receitasList = currentMonthTransactions.filter(t => t.type === 'income' && t.category !== 'Investimentos');

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
  const insights = getProfileInsights({
    profile,
    allTransactions,
    monthIncome: rendaLiquida,
    monthExpense: totalExpense,
    monthGargalo: gargalo,
    reserveAmount: reservaAtual,
    positions,
    debts,
  });

  const debtSummary = summarizeDebts(debts as any);
  const hasRegisteredDebts = debts.some(d => (d.status ?? 'ativa') === 'ativa');


  // Semáforo de 3 faixas, com os cortes vindos do perfil.
  const gargaloTier = comprometimentoRaw > insights.gargaloCritical
    ? 'critico'
    : comprometimentoRaw > insights.gargaloWarn
      ? 'atencao'
      : 'saudavel';
  const isGargaloCritico = gargaloTier === 'critico';

  const GARGALO_THEME = {
    saudavel: { hex: '#10b981', accent: 'emerald', text: 'text-emerald-400', glow: 'bg-emerald-500', panel: 'bg-white/5 border-white/10' },
    atencao:  { hex: '#f59e0b', accent: 'amber',   text: 'text-amber-400',   glow: 'bg-amber-500',   panel: 'bg-amber-500/5 border-amber-500/20' },
    critico:  { hex: '#f43f5e', accent: 'rose',    text: 'text-rose-400',    glow: 'bg-rose-500',    panel: 'bg-rose-500/5 border-rose-500/20' },
  }[gargaloTier];

  // Título, lista e cor de cada card clicável num lugar só. A cor do gargalo
  // acompanha o tier para o modal abrir na mesma cor do card que foi tocado —
  // abrir em cor diferente faz duvidar se é o mesmo número.
  const PILARES = {
    renda:   { title: 'Renda Líquida',       subtitle: 'tudo que entrou no mês',   list: receitasList,    accent: 'emerald' },
    fixos:   { title: 'Custos Fixos',        subtitle: 'o que você paga todo mês', list: custosFixosList, accent: 'blue' },
    gargalo: { title: 'Cartões & Variáveis', subtitle: 'onde o dinheiro escapa',   list: gargaloList,     accent: GARGALO_THEME.accent },
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

  function abrirGrupo(rotulo: string) {
    const mesmo = subcategoriaFiltro === rotulo;
    setSubcategoriaFiltro(mesmo ? null : rotulo);
    // Abrir um grupo e ainda esconder parte dele seria o mesmo problema de novo.
    setMostrarTodos(!mesmo);
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

  const todayStr = new Date().toISOString().split('T')[0];
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

  const dueBills = visibleTransactions.filter(t => {
    if (t.type !== 'expense' || t.is_paid) return false;
    return t.date <= threeDaysStr;
  });

  useEffect(() => {
    if (dueBills.length > 0) setHasUnread(true);
    else setHasUnread(false);
  }, [dueBills.length]);

  return (
    <BetaGate>
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-50 font-sans selection:bg-indigo-500/30">
      
      <nav className="hidden md:flex border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-black/20">
              <img src="/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-xl tracking-tight">Nexa</span>
          </div>
          
          <div className="flex items-center gap-4">
            <select 
              value={activeWalletId || ''} 
              onChange={(e) => setActiveWalletId(e.target.value || null)}
              className="bg-black/30 border border-white/10 text-white text-sm rounded-lg py-1.5 px-3 focus:outline-none focus:border-indigo-500 hidden sm:block"
            >
              <option value="">Todas Carteiras</option>
              {wallets.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <button onClick={() => setIsWalletsOpen(true)} className="text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1.5 rounded-lg font-medium transition-colors border border-indigo-500/20 hidden sm:block">
              Carteiras
            </button>

            <button onClick={() => { setIsActivityOpen(true); setHasUnread(false); }} className="text-neutral-400 hover:text-white transition-colors relative ml-2">
              <Bell className="w-5 h-5" />
              {hasUnread && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
            </button>
            <div onClick={() => setIsProfileOpen(true)} className={`w-9 h-9 border rounded-full flex items-center justify-center overflow-hidden cursor-pointer transition-colors ${userRole === 'admin' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-neutral-800 border-white/10 text-neutral-400 hover:border-emerald-500'}`}>
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-md md:max-w-7xl mx-auto px-6 pt-safe py-8 md:py-12">
        
        <header className="flex md:hidden justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 overflow-hidden bg-black/20">
              <img src="/icon-192.png" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase">Olá, {userEmail ? userEmail.split('@')[0] : 'Usuário'}</p>
              <h1 className="text-2xl font-bold text-white tracking-tight">Seu Nexa</h1>
            </div>
          </div>
          
          {/* Assinaturas e Conselheiro saíram daqui: ambos vivem no menu "Mais",
              e os ícones (lupa, alvo) não diziam o que abriam. */}
          <div className="flex gap-2">
             <button onClick={() => { setIsActivityOpen(true); setHasUnread(false); }} className="p-2.5 bg-white/5 rounded-full text-neutral-400 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5"/>
                {hasUnread && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>}
             </button>
          </div>
        </header>

        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 relative z-10">
          <div className="shrink-0 flex items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">Visão Geral</h1>
              <p className="text-neutral-400 text-sm md:text-base">Acompanhe e gerencie seu patrimônio</p>
            </div>
            <button
              onClick={() => setShowValues(!showValues)}
              className="p-2.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label={showValues ? "Ocultar valores" : "Mostrar valores"}
              title={showValues ? "Ocultar valores" : "Mostrar valores"}
            >
              {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>

            {/* Seletor de mês global.
                Antes vivia dentro do cabeçalho da seção "Organização", no meio
                da página — o usuário trocava os quatro cards do topo sem
                perceber de onde vinha a mudança. Aqui ele fica junto do título,
                deixando claro que escopa tudo. */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 w-fit">
              <button onClick={handlePrevMonth} aria-label="Mês anterior" className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <div className="w-32 text-center font-medium text-xs text-white tracking-wider uppercase">{MONTHS[activeMonth]} <span className="text-neutral-500">{activeYear}</span></div>
              <button onClick={handleNextMonth} aria-label="Próximo mês" className="p-1.5 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          
          {/* Atalhos: 3 ações primárias + menu. Antes eram 11 chips coloridos
              em linha, que no desktop quebravam em três fileiras. */}
          <div className="flex items-center gap-2.5 w-full xl:w-auto">
            <motion.button onClick={() => setIsPayYourselfOpen(true)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-4 sm:px-5 py-2.5 rounded-full font-medium transition-all active:scale-95 cursor-pointer border border-emerald-500/20 whitespace-nowrap">
              <PiggyBank className="w-4 h-4 shrink-0" /> <span className="text-sm">Poupar</span>
            </motion.button>

            {AI_ENABLED && (
              <motion.button onClick={() => setIsAiModalOpen(true)} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 sm:px-5 py-2.5 rounded-full font-medium transition-all shadow-lg shadow-purple-500/25 active:scale-95 cursor-pointer border border-white/10 whitespace-nowrap">
                {/* "Ler Foto" escondia o caso mais útil: ler uma fatura em PDF
                    e abrir compra por compra. */}
                <Sparkles className="w-4 h-4 shrink-0" /> <span className="text-sm">Ler Fatura</span>
              </motion.button>
            )}

            <motion.button onClick={handleOpenModal} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-white text-black px-4 sm:px-5 py-2.5 rounded-full font-bold transition-all hover:bg-neutral-200 active:scale-95 cursor-pointer whitespace-nowrap">
              <Plus className="w-4 h-4 shrink-0" /> <span className="text-sm">Lançar</span>
            </motion.button>

            <div className="relative shrink-0">
              <button
                onClick={() => setIsMenuOpen(v => !v)}
                className={`p-2.5 rounded-full border transition-colors cursor-pointer ${isMenuOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'}`}
                title="Mais ferramentas"
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
                      className="absolute right-0 top-full mt-2 w-60 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 origin-top-right"
                    >
                      {[
                        { label: 'Cartões',     icon: <CreditCard className="w-4 h-4" />,    color: 'text-purple-400',  action: () => setIsCardsOpen(true) },
                        { label: 'Relatórios',  icon: <PieChartIcon className="w-4 h-4" />,  color: 'text-indigo-400',  action: () => setIsReportsOpen(true) },
                        { label: 'Orçamentos',  icon: <Wallet className="w-4 h-4" />,        color: 'text-orange-400',  action: () => setIsBudgetOpen(true) },
                        { label: 'Metas',       icon: <Target className="w-4 h-4" />,        color: 'text-yellow-400',  action: () => setIsGoalsOpen(true) },
                        { label: 'Calendário',  icon: <Calendar className="w-4 h-4" />,      color: 'text-blue-400',    action: () => setIsCalendarOpen(true) },
                        { label: 'Assinaturas', icon: <Clock className="w-4 h-4" />,         color: 'text-teal-400',    action: () => setIsTrackerOpen(true) },
                        ...(AI_ENABLED ? [{ label: 'Conselheiro IA', icon: <Bot className="w-4 h-4" />, color: 'text-purple-400', action: () => setIsPlannerOpen(true) }] : []),
                        { label: 'Casal',       icon: <Heart className="w-4 h-4" />,         color: 'text-pink-400',    action: () => setIsCoupleOpen(true) },
                        { label: 'Previsão',    icon: <CalendarClock className="w-4 h-4" />,  color: 'text-blue-400',    action: () => setIsForecastOpen(true) },
                        { label: 'Raio-x dos gastos', icon: <PieChartIcon className="w-4 h-4" />, color: 'text-amber-400', action: () => setIsSpendingOpen(true) },
                        { label: 'Dívidas',     icon: <TrendingDown className="w-4 h-4" />,    color: 'text-rose-400',    action: () => setIsDebtsOpen(true) },
                        { label: 'Patrimônio',  icon: <LineChart className="w-4 h-4" />,     color: 'text-emerald-400', action: () => setIsInvestmentsOpen(true) },
                        { label: 'Perfil financeiro', icon: <SlidersHorizontal className="w-4 h-4" />, color: 'text-neutral-400', action: () => setIsProfileSettingsOpen(true) },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={() => { setIsMenuOpen(false); item.action(); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-left"
                        >
                          <span className={item.color}>{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {pronto && (
          <OnboardingChecklist
            transactions={allTransactions}
            hasDebtsRegistered={hasRegisteredDebts}
            declaredNoDebt={profile?.has_debt === false}
            onAction={handleOnboardingAction}
            onSecondaryAction={handleOnboardingSkip}
          />
        )}

        {/* Estágio financeiro: define o que o app prioriza para ESTE usuário */}
        {pronto && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setIsRoadmapOpen(true)}
            className={`w-full text-left mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 border rounded-2xl px-5 py-4 cursor-pointer hover:brightness-125 transition-all ${STAGE_PANEL[insights.stage.accent]}`}
          >
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STAGE_BADGE[insights.stage.accent]}`}>
                Estágio {insights.stage.level}/5
              </span>
              <span className="font-bold text-white text-sm">{insights.stage.label}</span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed sm:border-l sm:border-white/10 sm:pl-4 flex-1">
              {insights.needsOnboarding
                ? 'Responda 4 perguntas rápidas no seu perfil para o Nexa calibrar os limites ao seu caso.'
                : insights.stage.id === 'emergencia' && debtSummary.expensiveTotal > 0
                  // No Estágio 1 a prioridade vira número: dívida cara restante
                  // e o que ela cobra por mês. "Quite a dívida" sem valor é
                  // conselho; com valor é meta.
                  ? <>Dívida cara restante: <strong className="text-rose-300">{showValues ? formatMoney(debtSummary.expensiveTotal) : 'R$ •••••'}</strong>, custando <strong className="text-rose-300">{showValues ? formatMoney(debtSummary.expensiveMonthlyInterest) : 'R$ •••••'}</strong> por mês só de juros.</>
                  : insights.stage.id === 'emergencia' && !hasRegisteredDebts && profile?.has_debt
                    ? 'Você indicou ter dívida. Cadastre-a para o Nexa calcular quanto custa e quando acaba.'
                    : insights.stage.priority}
            </p>
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-neutral-500 font-semibold uppercase tracking-wider shrink-0">
              Ver jornada <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </motion.button>
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
              className="-mt-3 mb-6 px-5 text-xs text-neutral-500 leading-relaxed flex items-start gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400/70 shrink-0 mt-0.5" />
              {dicaDoMes}
            </motion.p>
          )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 pb-6 md:pb-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="min-w-[80%] md:min-w-0 h-40 bg-white/5 border border-white/10 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : erroCarregamento ? (
          <div className="pb-6 md:pb-8">
            <div className="bg-amber-500/5 border border-amber-500/25 rounded-3xl p-6 md:p-8 text-center">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <WifiOff className="w-6 h-6 text-amber-400" />
              </div>

              <h2 className="text-lg font-bold text-white mb-2">Não consegui carregar seus lançamentos</h2>
              <p className="text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
                Seus dados estão salvos e intactos — o que falhou foi a leitura
                agora. Nenhum número apareceria correto nesta tela, então
                preferi não mostrar nenhum.
              </p>

              <button
                onClick={carregarPainel}
                className="mt-6 bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar de novo
              </button>

              <p className="text-[11px] text-neutral-600 mt-5 break-words max-w-md mx-auto">
                Detalhe técnico: {erroCarregamento}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 pb-6 md:pb-8">
            <div className="md:col-span-3">
              <PillarCard
                title="Capacidade de Poupança"
                amount={showValues ? formatMoney(capacidadePoupanca) : 'R$ •••••'}
                caption={capacidadePoupanca >= 0 ? 'Disponível para construir patrimônio' : 'Você gastou mais do que ganhou'}
                icon={<PiggyBank className={`w-5 h-5 ${capacidadePoupanca >= 0 ? 'text-indigo-400' : 'text-rose-400'}`} />}
                accent={capacidadePoupanca >= 0 ? 'indigo' : 'rose'}
                highlight
                delay={0.4}
                secondary={{
                  label: 'Saldo em conta',
                  value: showValues ? formatMoney(balance) : 'R$ •••••',
                  positive: balance >= 0,
                  hint: sumCategory(investimentos) > 0
                    ? `Já descontados ${showValues ? formatMoney(sumCategory(investimentos)) : 'R$ •••••'} que você guardou`
                    : undefined,
                }}
              />
            </div>
            <div>
              <PillarCard
                title="Renda Líquida"
                amount={showValues ? formatMoney(rendaLiquida) : 'R$ •••••'}
                caption="Tudo que entrou no mês"
                icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
                accent="emerald"
                delay={0.1}
                onEditClick={() => setIsIncomeModalOpen(true)}
                onClick={() => setPilarAberto('renda')}
              />
            </div>
            <div>
              <PillarCard
                title="Custos Fixos"
                amount={showValues ? formatMoney(custosFixos) : 'R$ •••••'}
                caption="O que você paga todo mês"
                icon={<HomeIcon className="w-5 h-5 text-blue-400" />}
                accent="blue"
                delay={0.2}
                onClick={() => setPilarAberto('fixos')}
              />
            </div>
            <div>
              <PillarCard
                title="Cartões & Variáveis"
                amount={showValues ? formatMoney(gargalo) : 'R$ •••••'}
                caption={gargaloTier === 'critico' ? 'Bem acima do seu teto — corte aqui primeiro' : gargaloTier === 'atencao' ? 'Acima do seu teto de consumo' : 'Onde o dinheiro escapa'}
                icon={<CreditCard className={`w-5 h-5 ${GARGALO_THEME.text}`} />}
                accent={GARGALO_THEME.accent}
                /* A badge mostra o dado, não um rótulo: "38% da renda" responde
                   "isso está bom ou ruim?" — "Gargalo" exigia decorar o jargão.
                   Some quando não há gasto ou quando não há renda para comparar. */
                badge={gargalo > 0 && rendaLiquida > 0
                  ? (showValues ? `${comprometimentoRaw.toFixed(0)}% da renda` : '••% da renda')
                  : undefined}
                delay={0.3}
                onClick={() => setPilarAberto('gargalo')}
              />
            </div>
          </div>
        )}

        {/* Termômetro removido: o anel repetia o % que o card de Cartões &
            Variáveis já mostra no badge, ocupando uma faixa inteira. */}
        {pronto && (
          <div className="mb-8">
          <ReserveWidget
            goal={reservaGoal}
            current={reservaAtual}
            minimum={insights.reserveMinimum}
            ideal={insights.reserveIdeal}
            monthlyCost={insights.monthlyCost}
            reserveMonths={insights.reserveMonths}
            showValues={showValues}
            formatMoney={formatMoney}
            onCreate={handleCreateReserveGoal}
            onAddFunds={handleAddToReserve}
          />
          </div>
        )}

        {/* Organização saiu da home: os 4 cards listavam cada lançamento e
            ocupavam meia tela repetindo o que o "Raio-x dos gastos" já faz
            melhor, comparando cada categoria com a própria mediana. */}
        <div className="flex flex-col gap-8">

          {pronto && <ResumoOndeFoi transactions={currentMonthTransactions} showValues={showValues} onImportar={() => setIsAiModalOpen(true)} onSelecionar={abrirGrupo} filtroAtivo={subcategoriaFiltro} />}

          <div className="w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm h-full">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex justify-between items-center gap-3">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {buscaForaDoMes ? 'Resultados' : `Lançamentos de ${MONTHS[activeMonth]}`}
                  </h2>
                  {buscaForaDoMes && (
                    <span className="text-[11px] text-neutral-500 shrink-0">de todos os meses</span>
                  )}
                </div>

                {subcategoriaFiltro && (
                  <div className="flex items-center gap-2 -mt-1">
                    <span className="text-xs text-neutral-500">Mostrando apenas</span>
                    <button
                      onClick={() => { setSubcategoriaFiltro(null); setMostrarTodos(false); }}
                      className="inline-flex items-center gap-1.5 bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg text-xs font-semibold hover:bg-indigo-500/25 transition-colors cursor-pointer"
                    >
                      {subcategoriaFiltro}
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-neutral-500">
                      {listaFiltrada.length} {listaFiltrada.length === 1 ? 'compra' : 'compras'}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input type="text" placeholder="Buscar gastos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                  <button 
                    onClick={() => setFilterPending(!filterPending)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border whitespace-nowrap ${filterPending ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-black/20 text-neutral-400 border-white/10 hover:text-white'}`}
                  >
                    A Vencer
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {recentTransactions.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    {subcategoriaFiltro
                      ? `Nenhuma compra em ${subcategoriaFiltro} aqui.`
                      : buscaForaDoMes
                        ? 'Nada encontrado com esse filtro.'
                        : `Nenhum lançamento em ${MONTHS[activeMonth]} de ${activeYear}.`}
                  </p>
                ) : (
                  recentTransactions.map((tx) => (
                    <TransactionRow key={tx.id} title={tx.title} category={tx.category} date={new Date(tx.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} amount={showValues ? `${tx.type === 'income' ? '+' : '-'} R$ ${tx.amount.toFixed(2).replace('.', ',')}` : 'R$ •••••'} type={tx.type} isPaid={tx.is_paid} onTogglePaid={() => handleTogglePaid(tx.id, tx.is_paid)} onDelete={() => handleDeleteTransaction(tx.id)} onEdit={() => handleEditTransaction(tx)} receiptUrl={tx.receipt_url} subcategoria={tx.subcategoria} />
                  ))
                )}

                {ocultos > 0 && (
                  <button
                    onClick={() => setMostrarTodos(true)}
                    className="w-full py-3 rounded-2xl border border-white/10 bg-black/20 text-sm font-semibold text-neutral-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                  >
                    Ver mais {ocultos} {ocultos === 1 ? 'lançamento' : 'lançamentos'}
                  </button>
                )}

                {mostrarTodos && listaFiltrada.length > LIMITE_LISTA && (
                  <button
                    onClick={() => setMostrarTodos(false)}
                    className="w-full py-2.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    Mostrar menos
                  </button>
                )}
              </div>
            </motion.div>
          </div>

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
      <GoalsModal isOpen={isGoalsOpen} onClose={() => setIsGoalsOpen(false)} />
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

/**
 * Reserva de Emergência — a barra que mede o app inteiro.
 *
 * Os marcos NÃO são fixos: `minimum` e `ideal` vêm do lib/profile.ts, calculados
 * sobre o CUSTO DE VIDA do usuário (3 e 6 meses; 6 e 12 se a renda for
 * variável). Quem ganha R$ 15.000 e quem ganha R$ 1.800 veem metas diferentes.
 */
function ReserveWidget({ goal, current, minimum, ideal, monthlyCost, reserveMonths, showValues, formatMoney, onCreate, onAddFunds }: any) {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  // Respeita um alvo editado à mão na tela de Metas; senão usa o calculado.
  const target = Number(goal?.target_amount) || ideal;
  const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const minMarker = target > 0 ? Math.min(100, (minimum / target) * 100) : 0;
  const atingiuMinimo = current >= minimum && minimum > 0;
  const completa = target > 0 && current >= target;

  const handleAdd = async () => {
    const v = parseFloat(value);
    if (!v || v <= 0) return;
    setIsBusy(true);
    await onAddFunds(v);
    setIsBusy(false);
    setValue("");
    setIsAdding(false);
  };

  // Sem custo de vida apurado não há meta confiável para oferecer.
  if (!goal && (!ideal || ideal <= 0)) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="h-full bg-white/5 border border-white/10 rounded-3xl p-5 md:p-6 backdrop-blur-xl flex flex-col justify-center items-center text-center gap-2">
        <ShieldCheck className="w-6 h-6 text-neutral-600" />
        <h3 className="font-bold text-white text-sm">Reserva de Emergência</h3>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-xs">
          Lance algumas despesas para o Nexa descobrir seu custo de vida e calcular a reserva certa para você.
        </p>
      </motion.div>
    );
  }

  if (!goal) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="h-full bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-5 md:p-6 backdrop-blur-xl flex flex-col justify-center gap-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 bg-emerald-500"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="font-bold text-white text-lg">Reserva de Emergência</h3>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed mb-4">
            Com seu custo de vida de {showValues ? formatMoney(monthlyCost) : 'R$ •••••'} por mês, sua reserva ideal é de{' '}
            <strong className="text-emerald-400">{showValues ? formatMoney(ideal) : 'R$ •••••'}</strong>. É o colchão que te impede de voltar pro cartão quando algo dá errado.
          </p>
          <button
            onClick={() => onCreate(ideal)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" /> Criar minha reserva
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className={`h-full border rounded-3xl p-5 md:p-6 backdrop-blur-xl flex flex-col relative overflow-hidden ${completa ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/10'}`}>
      <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 ${completa ? 'bg-emerald-500' : atingiuMinimo ? 'bg-blue-500' : 'bg-amber-500'}`}></div>

      <div className="flex items-start justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2.5 rounded-2xl border shrink-0 ${completa ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : atingiuMinimo ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base leading-tight">Reserva de Emergência</h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {reserveMonths > 0 ? `${reserveMonths.toFixed(1)} meses de custo cobertos` : 'Ainda sem aporte'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsAdding(v => !v)}
          className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Adicionar à reserva"
        >
          <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden relative z-10">
            <div className="flex gap-2 mb-5">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="0,00"
                  className="w-full bg-black/30 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white text-sm font-semibold placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <button
                onClick={handleAdd}
                disabled={isBusy || !value}
                className="px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-sm"
              >
                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Somar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto relative z-10">
        <div className="flex justify-between items-end mb-2">
          <span className={`text-2xl font-extrabold tracking-tight ${completa ? 'text-emerald-400' : 'text-white'}`}>
            {showValues ? formatMoney(current) : 'R$ •••••'}
          </span>
          <span className="text-xs text-neutral-500 font-medium">
            de {showValues ? formatMoney(target) : 'R$ •••••'}
          </span>
        </div>

        {/* Barra com o marco do mínimo (3 meses de custo, ou 6 se renda variável) */}
        <div className="relative w-full h-3 bg-black/40 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`h-full rounded-full ${completa ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : atingiuMinimo ? 'bg-gradient-to-r from-blue-500 to-indigo-400' : 'bg-gradient-to-r from-amber-500 to-orange-400'}`}
          />
          {minMarker > 0 && minMarker < 100 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10" style={{ left: `${minMarker}%` }} />
          )}
        </div>

        <div className="flex justify-between mt-2 text-[10px] font-medium">
          <span className={atingiuMinimo ? 'text-emerald-400' : 'text-neutral-500'}>
            {atingiuMinimo && '✓ '}Mínimo {showValues ? formatMoney(minimum) : '•••'}
          </span>
          <span className={completa ? 'text-emerald-400' : 'text-neutral-500'}>
            {completa && '✓ '}Ideal {showValues ? formatMoney(target) : '•••'}
          </span>
        </div>

        <p className="text-[11px] text-neutral-500 mt-3 leading-relaxed">
          {completa
            ? 'Reserva completa. A partir daqui, o excedente vai para investimento de longo prazo.'
            : atingiuMinimo
              ? 'Você já aguenta uma emergência. Siga até o ideal para ficar fora de perigo de vez.'
              : `Faltam ${showValues ? formatMoney(Math.max(0, minimum - current)) : 'R$ •••••'} para o mínimo — o ponto em que uma emergência deixa de virar dívida.`}
        </p>
      </div>
    </motion.div>
  );
}

const STAGE_PANEL: Record<string, string> = {
  rose:    'bg-rose-500/5 border-rose-500/20',
  amber:   'bg-amber-500/5 border-amber-500/20',
  blue:    'bg-blue-500/5 border-blue-500/20',
  indigo:  'bg-indigo-500/5 border-indigo-500/20',
  emerald: 'bg-emerald-500/5 border-emerald-500/20',
};

const STAGE_BADGE: Record<string, string> = {
  rose:    'text-rose-400 bg-rose-400/10',
  amber:   'text-amber-400 bg-amber-400/10',
  blue:    'text-blue-400 bg-blue-400/10',
  indigo:  'text-indigo-400 bg-indigo-400/10',
  emerald: 'text-emerald-400 bg-emerald-400/10',
};

const PILLAR_ACCENTS: Record<string, { ring: string; glow: string; badge: string }> = {
  emerald: { ring: 'border-emerald-500/20', glow: 'bg-emerald-500', badge: 'text-emerald-400 bg-emerald-400/10' },
  blue:    { ring: 'border-blue-500/20',    glow: 'bg-blue-500',    badge: 'text-blue-400 bg-blue-400/10' },
  purple:  { ring: 'border-purple-500/20',  glow: 'bg-purple-500',  badge: 'text-purple-400 bg-purple-400/10' },
  amber:   { ring: 'border-amber-500/20',   glow: 'bg-amber-500',   badge: 'text-amber-400 bg-amber-400/10' },
  indigo:  { ring: 'border-indigo-500/20',  glow: 'bg-indigo-500',  badge: 'text-indigo-400 bg-indigo-400/10' },
  rose:    { ring: 'border-rose-500/20',    glow: 'bg-rose-500',    badge: 'text-rose-400 bg-rose-400/10' },
};

function PillarCard({ title, amount, caption, icon, accent = 'indigo', badge, highlight, delay, onEditClick, secondary, onClick }: any) {
  const theme = PILLAR_ACCENTS[accent] ?? PILLAR_ACCENTS.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      // Card inteiro como alvo: no celular, um botãozinho "ver detalhes" seria
      // alvo pequeno justo onde o dedo erra mais.
      onKeyDown={onClick ? (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      } : undefined}
      className={`h-full bg-gradient-to-br from-white/10 to-white/5 border p-6 rounded-[2rem] backdrop-blur-xl relative overflow-hidden flex flex-col transition-colors ${highlight ? theme.ring : 'border-white/10'} ${onClick ? 'cursor-pointer hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40' : ''}`}
    >
      <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full blur-3xl opacity-20 ${theme.glow}`}></div>

      <div className="flex justify-between items-start mb-5 relative z-10">
        <div className="p-3.5 bg-white/10 rounded-2xl border border-white/10 shadow-inner">{icon}</div>

        <div className="flex items-center gap-2">
          {onEditClick && (
            <button
              /* Sem o stopPropagation, o clique no lápis subiria para o card e
                 abriria o modal de lançamentos junto com o de edição. */
              onClick={(e) => { e.stopPropagation(); onEditClick(); }}
              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-full transition-colors cursor-pointer"
              title="Editar receitas"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {badge && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${theme.badge}`}>{badge}</span>
          )}
        </div>
      </div>

      <p className="text-neutral-400 text-sm font-medium mb-1 tracking-wide relative z-10">{title}</p>
      <h3 className={`text-3xl font-extrabold tracking-tight relative z-10 ${amount === 'R$ 0,00' ? 'text-neutral-500' : 'text-white'}`}>{amount}</h3>
      {caption && <p className="text-[11px] text-neutral-500 mt-2 relative z-10 leading-snug">{caption}</p>}

      {/* Linha secundária: um segundo número que pertence ao mesmo assunto,
          em vez de virar um bloco separado na página. */}
      {secondary && (
        <div className="mt-auto pt-3 border-t border-white/10 relative z-10">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-neutral-500 font-medium">{secondary.label}</span>
            <span className={`text-sm font-bold tracking-tight whitespace-nowrap ${secondary.positive === false ? 'text-rose-400' : secondary.positive === true ? 'text-emerald-400' : 'text-white'}`}>
              {secondary.value}
            </span>
          </div>
          {secondary.hint && <p className="text-[10px] text-neutral-600 mt-1 leading-snug">{secondary.hint}</p>}
        </div>
      )}
    </motion.div>
  );
}

function ReceiptButton({ stored }: { stored: string }) {
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    setIsOpening(true);
    const url = await getReceiptUrl(stored);
    setIsOpening(false);
    if (!url) {
      toast("Não consegui abrir este comprovante.", "error");
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={open}
      disabled={isOpening}
      aria-label="Abrir comprovante"
      title="Abrir comprovante"
      className="p-2 text-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50"
    >
      {isOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
    </button>
  );
}

/**
 * "Onde foi o dinheiro" — despesa do mês agrupada pelo segundo eixo.
 *
 * Existe porque `category` responde a natureza do gasto (fixo, variável,
 * cartão) e não responde onde ele aconteceu. Numa fatura de cartão importada,
 * tudo cai em "Cartões" — útil para o orçamento, inútil para saber que metade
 * foi em delivery.
 *
 * A barra é relativa ao maior grupo, não ao total: com 12 grupos, barra sobre
 * o total fica toda minúscula e não se compara nada. O percentual sobre o
 * total vai em texto, ao lado.
 */
function ResumoOndeFoi({ transactions, showValues, onImportar, onSelecionar, filtroAtivo }: any) {
  const resumo = resumoPorSubcategoria(transactions);

  // Mês sem despesa, ou base toda anterior à coluna existir: não vale ocupar
  // tela com um card vazio.
  if (resumo.length === 0) return null;

  // Uma barra só, e sem nome, não informa nada — era o caso de quem lançou a
  // fatura inteira como um item. Mostrar "Outros 100%" ocupa tela e não
  // responde a pergunta do card, então aqui ele explica como obter a resposta.
  const semSinal = resumo.every(
    (i) => i.rotulo === 'Outros' || i.rotulo === NAO_CLASSIFICADO,
  );

  if (semSinal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold tracking-tight">Onde foi o dinheiro</h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          As despesas deste mês ainda não estão separadas por onde aconteceram.
          Um lançamento manual vira <strong className="text-neutral-300">um item só</strong> —
          mesmo anexando a fatura em Comprovante, que apenas guarda o arquivo.
        </p>

        {/* Sem a flag ligada não existe botão de IA em lugar nenhum da tela.
            Mandar "use a leitura por IA" aqui apontaria para um recurso
            invisível, que é pior que não sugerir nada. */}
        {AI_ENABLED && onImportar ? (
          <>
            <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
              Para abrir a fatura compra por compra, envie o arquivo pela leitura por IA.
            </p>
            <button
              onClick={onImportar}
              className="mt-4 inline-flex items-center gap-2 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Ler fatura e separar as compras
            </button>
          </>
        ) : (
          <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
            Você pode classificar cada gasto no lápis do lançamento, em{' '}
            <strong className="text-neutral-300">Onde foi o gasto</strong>.
          </p>
        )}
      </motion.div>
    );
  }

  const maior = resumo[0].total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold tracking-tight">Onde foi o dinheiro</h2>
      <p className="text-xs text-neutral-500 mt-1 mb-5">
        Despesas deste mês por onde você gastou. O orçamento continua por categoria.
      </p>

      <div className="flex flex-col gap-1">
        {resumo.map((item) => {
          const semNome = item.rotulo === NAO_CLASSIFICADO;
          const ativo = filtroAtivo === item.rotulo;
          return (
            <button
              key={item.rotulo}
              onClick={() => onSelecionar?.(item.rotulo)}
              aria-pressed={ativo}
              className={`text-left rounded-xl px-2.5 py-2 -mx-2.5 transition-colors cursor-pointer ${ativo ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className={`text-sm font-medium truncate ${semNome ? 'text-neutral-500 italic' : ativo ? 'text-indigo-300' : 'text-neutral-200'}`}>
                  {item.rotulo}
                </span>
                <span className="text-sm font-bold text-white whitespace-nowrap">
                  {formatMoney(item.total, showValues)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${semNome ? 'bg-neutral-600' : 'bg-indigo-500'}`}
                    style={{ width: `${Math.max((item.total / maior) * 100, 2)}%` }}
                  />
                </div>
                <span className="text-[11px] text-neutral-500 w-[4.5rem] text-right shrink-0 tabular-nums">
                  {item.percentual.toFixed(0)}% · {item.itens}x
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-neutral-600 mt-4">
        Toque num grupo para ver as compras dele na lista abaixo.
      </p>
    </motion.div>
  );
}

function TransactionRow({ title, category, date, amount, type, isPaid, onTogglePaid, onDelete, onEdit, receiptUrl, subcategoria }: any) {
  const isIncome = type === 'income';
  return (
    <div className={`flex flex-wrap items-center justify-between p-3.5 rounded-2xl border transition-colors gap-y-3 gap-x-2 overflow-hidden ${isPaid === false ? 'bg-amber-500/5 border-amber-500/10' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}>
      
      {/* Esquerda: Icone e Textos */}
      <div className="flex items-center gap-3 flex-[1_1_180px] min-w-0">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 ${isIncome ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-rose-400/10 border-rose-400/20 text-rose-400'}`}>
          {isIncome ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        
        <div className="flex flex-col min-w-0 py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={`font-semibold text-sm line-clamp-2 leading-snug ${isPaid === false ? 'text-amber-100' : 'text-white'}`}>
              {title || "Sem título"}
            </h4>
            {isPaid === false && <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider shrink-0 mt-0.5">Pendente</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 uppercase tracking-wide font-medium mt-1">
            <span className="line-clamp-1">{category || "Sem Categoria"}</span>
            {subcategoria && (
              <>
                <span className="w-1 h-1 bg-neutral-700 rounded-full shrink-0"></span>
                <span className="shrink-0 text-indigo-400/80">{subcategoria}</span>
              </>
            )}
            <span className="w-1 h-1 bg-neutral-700 rounded-full shrink-0"></span>
            <span className="shrink-0">{date || "Sem data"}</span>
          </div>
        </div>
      </div>

      {/* Direita: Valor e Botões */}
      <div className="flex items-center justify-end gap-1.5 shrink-0 flex-[1_1_150px]">
        <div className={`font-bold text-sm tracking-tight whitespace-nowrap mr-auto sm:mr-1 ${isIncome ? 'text-emerald-400' : (isPaid === false ? 'text-amber-400' : 'text-white')}`}>
          {amount}
        </div>
        {isPaid !== undefined && (
          <button onClick={onTogglePaid} className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${isPaid ? 'text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10' : 'text-amber-500/80 hover:text-amber-400 hover:bg-amber-500/10'}`}>
            {isPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
          </button>
        )}
        {receiptUrl && <ReceiptButton stored={receiptUrl} />}
        <button onClick={onEdit} className="p-2 text-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors cursor-pointer shrink-0"><Edit2 className="w-4 h-4" /></button>
        <button onClick={onDelete} className="p-2 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer shrink-0"><Trash2 className="w-4 h-4" /></button>
      </div>
      
    </div>
  );
}

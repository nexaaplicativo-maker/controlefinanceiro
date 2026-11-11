"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, PieChart as PieChartIcon, BarChart3, TrendingUp, TrendingDown, Download, FileText, ChevronLeft, ChevronRight, PiggyBank } from "lucide-react";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from "recharts";
import { useState } from "react";
import { toast } from "./Toast";
import { formatMoney } from "../lib/format";
import { hojeEmSaoPaulo } from "../lib/data";
import { EmptyState } from "./ui/Surface";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Fatias da rosquinha: um tom só, do claro ao escuro.
 *
 * Antes eram sete matizes diferentes — roxo, azul, verde, âmbar, vermelho,
 * rosa, índigo. Sete cores sem relação entre si fazem o gráfico parecer sete
 * assuntos, quando é um só repartido. E duas delas colidiam com o verde de
 * "positivo" e o vermelho de "negativo", que no resto do app querem dizer
 * outra coisa.
 *
 * Numa rampa de um tom, a ordem da legenda e a ordem do gráfico são a mesma
 * informação: mais escuro é menor.
 */
const COLORS = ['#b9d7e6', '#8fbdd3', '#6fa8c2', '#548ea8', '#40748c', '#2f5a70', '#224456'];

const COR_POS = '#5fd39b';
const COR_NEG = '#f0776e';
const COR_BRAND = '#8fbdd3';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function ReportsModal({ isOpen, onClose, transactions, allTransactions, activeMonth, activeYear, onPrevMonth, onNextMonth }: any) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'categorias' | 'balanco'>('categorias');
  const [periodFilter, setPeriodFilter] = useState<'month' | 'quarter' | 'semester' | 'year' | 'all'>('month');

  // Filtragem e ordenação cronológica das transações (útil para o CSV e PDF)
  const displayedTransactions = allTransactions.filter((t: any) => {
    if (!t.date) return false;
    if (periodFilter === 'all') return true;

    const [tYearStr, tMonthStr] = t.date.split('-');
    const tYear = parseInt(tYearStr);
    const tMonth = parseInt(tMonthStr) - 1;

    if (periodFilter === 'month') return tYear === activeYear && tMonth === activeMonth;
    if (periodFilter === 'year') return tYear === activeYear;

    const tDate = new Date(tYear, tMonth, 1);
    const aDate = new Date(activeYear, activeMonth, 1);
    const monthsDiff = (aDate.getFullYear() - tDate.getFullYear()) * 12 + (aDate.getMonth() - tDate.getMonth());

    if (periodFilter === 'quarter') return monthsDiff >= 0 && monthsDiff < 3;
    if (periodFilter === 'semester') return monthsDiff >= 0 && monthsDiff < 6;
    
    return true;
  }).sort((a: any, b: any) => a.date.localeCompare(b.date));

  const getPeriodLabel = () => {
    switch (periodFilter) {
      case 'month': return `${MONTHS[activeMonth] || 'Mês'} ${activeYear || ''}`;
      case 'quarter': return `Último Trimestre`;
      case 'semester': return `Último Semestre`;
      case 'year': return `Ano de ${activeYear}`;
      case 'all': return 'Histórico Completo';
      default: return '';
    }
  };
  const periodLabel = getPeriodLabel();

  if (!isOpen) return null;

  // Aporte não é consumo: sai da conta, mas continua sendo seu dinheiro.
  // Incluí-lo entre as despesas fazia o gráfico sugerir que o usuário "gastou"
  // com investimento, competindo em tamanho com Cartões e Variáveis.
  const isInvestment = (t: any) => t.category === 'Investimentos';

  // Processar dados para o Gráfico de Pizza — só gasto de verdade
  const expenses = displayedTransactions.filter((t: any) => t.type === 'expense' && !isInvestment(t));
  const categoryDataRaw = expenses.reduce((acc: any, curr: any) => {
    if (!acc[curr.category]) acc[curr.category] = 0;
    acc[curr.category] += curr.amount;
    return acc;
  }, {});

  // Aportes do período, mostrados à parte como patrimônio (líquido de resgates).
  const investedInPeriod = displayedTransactions
    .filter(isInvestment)
    .reduce((acc: number, t: any) => acc + (t.type === 'expense' ? t.amount : -t.amount), 0);

  const categoryData = Object.keys(categoryDataRaw).map(key => ({
    name: key,
    value: categoryDataRaw[key]
  })).sort((a, b) => b.value - a.value);

  // Processar dados para o Gráfico de Barras — sempre usa histórico completo para o gráfico de barras
  const barSourceData = allTransactions || transactions;
  const monthlyDataRaw = barSourceData.reduce((acc: any, curr: any) => {
    if (!curr.date) return acc;
    const dateObj = new Date(curr.date);
    const monthYear = dateObj.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    
    if (!acc[monthYear]) acc[monthYear] = { name: monthYear, Receitas: 0, Despesas: 0, Investido: 0 };

    // Investimentos formam a própria série: aporte não é despesa e resgate não
    // é receita. Misturá-los distorcia as duas barras ao mesmo tempo.
    if (isInvestment(curr)) {
      acc[monthYear].Investido += curr.type === 'expense' ? curr.amount : -curr.amount;
    } else if (curr.type === 'income') {
      acc[monthYear].Receitas += curr.amount;
    } else {
      acc[monthYear].Despesas += curr.amount;
    }

    return acc;
  }, {});

  // AQUI: Forçamos o tipo para evitar o pânico do TypeScript
  const balanceData: any[] = Object.values(monthlyDataRaw).slice(0, 6).reverse();


  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-field shadow-xl z-50">
          <p className="text-ink font-bold mb-1">{label || payload[0].name}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <span className="text-ink-2">{entry.name}:</span>
              <span className="text-ink font-bold">{formatMoney(Number(entry.value))}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleExportCSV = () => {
    if (!displayedTransactions || displayedTransactions.length === 0) {
      toast("Nenhuma transação para exportar.", "warning");
      return;
    }
    
    const headers = ["ID", "Título", "Categoria", "Valor", "Tipo", "Data", "Status"];
    const rows = displayedTransactions.map((t: any) => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      t.amount.toFixed(2).replace('.', ','),
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.date,
      t.is_paid === false ? 'Pendente' : 'Pago'
    ]);

    const csvContent = [headers.join(";"), ...rows.map((row: any[]) => row.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `extrato_nexa_${periodLabel.replace(' ', '_')}_${hojeEmSaoPaulo()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("CSV exportado com sucesso! 📄", "success");
  };

  const handleExportPDF = async () => {
    if (!displayedTransactions || displayedTransactions.length === 0) {
      toast("Nenhuma transação para exportar.", "warning");
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const today = new Date().toLocaleDateString('pt-BR');

      // Header
      doc.setFillColor(17, 17, 27);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('NEXA', 15, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 160, 180);
      doc.text('Relatório Financeiro', 15, 30);
      doc.text(`Período: ${periodLabel}`, 15, 37);
      doc.text(`Gerado em: ${today}`, pageWidth - 15, 30, { align: 'right' });

      // Summary
      // Mesma regra do dashboard: investimento fica fora de receita e despesa.
      const totalIncome = displayedTransactions.filter((t: any) => t.type === 'income' && !isInvestment(t)).reduce((a: number, t: any) => a + t.amount, 0);
      const totalExpense = displayedTransactions.filter((t: any) => t.type === 'expense' && !isInvestment(t)).reduce((a: number, t: any) => a + t.amount, 0);
      const balance = totalIncome - totalExpense;

      doc.setTextColor(30, 30, 30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo Geral', 15, 55);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(16, 185, 129);
      doc.text(`Receitas Totais: ${formatMoney(totalIncome)}`, 15, 65);
      doc.setTextColor(239, 68, 68);
      doc.text(`Despesas Totais: ${formatMoney(totalExpense)}`, 15, 73);
      doc.setTextColor(balance >= 0 ? 16 : 239, balance >= 0 ? 185 : 68, balance >= 0 ? 129 : 68);
      doc.setFont('helvetica', 'bold');
      doc.text(`Saldo: ${formatMoney(balance)}`, 15, 81);

      // Table header
      let y = 95;
      doc.setTextColor(255, 255, 255);
      doc.setFillColor(99, 102, 241);
      doc.rect(10, y - 6, pageWidth - 20, 10, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Data', 13, y);
      doc.text('Título', 35, y);
      doc.text('Categoria', 100, y);
      doc.text('Tipo', 145, y);
      doc.text('Valor', 165, y);
      doc.text('Status', 187, y);
      y += 8;



      doc.setFont('helvetica', 'normal');
      displayedTransactions.slice().reverse().forEach((t: any, i: number) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        const isIncome = t.type === 'income';
        doc.setFillColor(i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 245 : 255, i % 2 === 0 ? 250 : 255);
        doc.rect(10, y - 5, pageWidth - 20, 9, 'F');
        doc.setTextColor(60, 60, 60);
        doc.text(new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }), 13, y);
        doc.text(t.title?.substring(0, 30) || '-', 35, y);
        doc.text(t.category?.substring(0, 20) || '-', 100, y);
        doc.setTextColor(isIncome ? 16 : 239, isIncome ? 185 : 68, isIncome ? 129 : 68);
        doc.text(isIncome ? 'Receita' : 'Despesa', 145, y);
        doc.setTextColor(60, 60, 60);
        doc.text(formatMoney(t.amount), 165, y);
        doc.setTextColor(t.is_paid === false ? 217 : 16, t.is_paid === false ? 119 : 185, t.is_paid === false ? 6 : 129);
        doc.text(t.is_paid === false ? 'Pendente' : 'Pago', 187, y);
        y += 9;
      });

      // Footer
      doc.setTextColor(160, 160, 180);
      doc.setFontSize(8);
      doc.text('Gerado pelo Nexa — Controle Financeiro Inteligente', pageWidth / 2, 290, { align: 'center' });

      doc.save(`relatorio_nexa_${hojeEmSaoPaulo()}.pdf`);
      toast("📄 PDF exportado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao gerar PDF.", "error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-safe">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />
          <motion.div ref={a11yRef} role="dialog" aria-modal="true" 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-2xl bg-surface sm:rounded-card rounded-t-3xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col max-h-[90vh] border border-white/10"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-start bg-white/5 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-field bg-brand/20 flex items-center justify-center border border-brand/30 shadow-inner">
                  <PieChartIcon className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink tracking-tight">Relatórios</h2>
                  {periodFilter === 'month' ? (
                    <div className="flex items-center gap-2 mt-0.5">
                      <button onClick={onPrevMonth} className="p-0.5 text-ink-2 hover:text-ink transition-colors cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
                      <p className="text-xs text-ink-2 font-medium">{periodLabel}</p>
                      <button onClick={onNextMonth} className="p-0.5 text-ink-2 hover:text-ink transition-colors cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-2 mt-0.5">{periodLabel}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filtro de Período */}
                <select 
                  value={periodFilter} 
                  onChange={(e: any) => setPeriodFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-2 outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 cursor-pointer appearance-none pr-8 relative"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239CA3AF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value="month">Mensal</option>
                  <option value="quarter">Trimestral</option>
                  <option value="semester">Semestral</option>
                  <option value="year">Anual</option>
                  <option value="all">Todo Histórico</option>
                </select>
                <button onClick={handleExportCSV} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-line">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button onClick={handleExportPDF} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-line">
                  <FileText className="w-4 h-4" /> PDF
                </button>
                <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex p-4 gap-2 bg-white/5 border-b border-white/5 overflow-x-auto scrollbar-hide">
              <button 
                onClick={() => setActiveTab('categorias')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-field font-medium transition-all whitespace-nowrap ${activeTab === 'categorias' ? 'bg-brand/15 text-brand border border-brand/30' : 'text-ink-2 hover:bg-white/5'}`}
              >
                <PieChartIcon className="w-4 h-4" /> Despesas por Categoria
              </button>
              <button 
                onClick={() => setActiveTab('balanco')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-field font-medium transition-all whitespace-nowrap ${activeTab === 'balanco' ? 'bg-brand/15 text-brand border border-brand/30' : 'text-ink-2 hover:bg-white/5'}`}
              >
                <BarChart3 className="w-4 h-4" /> Balanço Mensal
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              
              {activeTab === 'categorias' && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
                  {categoryData.length === 0 ? (
                    <EmptyState icon={<PieChartIcon className="h-6 w-6" />} title="Nenhuma despesa neste período." description="Assim que houver gasto no mês escolhido, a divisão por categoria aparece aqui." />
                  ) : (
                    <>
                      <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={categoryData} cx="50%" cy="50%" innerRadius={70} outerRadius={100}
                              paddingAngle={5} dataKey="value" stroke="none"
                            >
                              {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xs text-ink-3 tracking-wide">Gasto</span>
                          <span className="text-2xl font-semibold tracking-tight text-ink tnum">
                            {formatMoney(Number(categoryData.reduce((a, b) => a + b.value, 0)))}
                          </span>
                        </div>
                      </div>

                      {investedInPeriod !== 0 && (
                        <p className="text-xs text-ink-3 text-center mt-3 leading-relaxed">
                          <PiggyBank className="w-3 h-3 text-brand inline mr-1" />
                          Fora daqui: <strong className="text-brand">{formatMoney(investedInPeriod)}</strong> em aportes.
                          Investimento não é gasto — continua sendo seu dinheiro.
                        </p>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        {categoryData.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-field">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-sm font-medium text-ink-2">{item.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-ink tnum">{formatMoney(Number(item.value))}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {activeTab === 'balanco' && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-6">
                  {balanceData.length === 0 ? (
                     <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Ainda não há meses para comparar." description="O balanço precisa de pelo menos um mês fechado para desenhar a comparação." />
                  ) : (
                    <>
                      <div className="h-72 w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={balanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            {/* Barra acesa no topo e dissolvendo na base: o olho
                                compara as alturas sem a grade ajudar, e o gráfico
                                para de competir com o conteúdo em volta. */}
                            <defs>
                              {[['gReceitas', COR_POS], ['gDespesas', COR_NEG], ['gInvestido', COR_BRAND]].map(([id, cor]) => (
                                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={cor} stopOpacity={0.95} />
                                  <stop offset="100%" stopColor={cor} stopOpacity={0.15} />
                                </linearGradient>
                              ))}
                            </defs>
                            {/* Sem grade: a referência não tem, e cada linha a mais
                                é ruído atrás do dado. */}
                            <XAxis dataKey="name" tick={{ fill: '#5d6975', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#5d6975', fontSize: 12 }} axisLine={false} tickLine={false} tickCount={4} tickFormatter={(val) => `R$ ${val}`} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                            <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12, color: '#93a1ac' }} iconType="circle" iconSize={8} />
                            <Bar dataKey="Receitas" fill="url(#gReceitas)" radius={[6, 6, 0, 0]} barSize={16} />
                            <Bar dataKey="Despesas" fill="url(#gDespesas)" radius={[6, 6, 0, 0]} barSize={16} />
                            <Bar dataKey="Investido" fill="url(#gInvestido)" radius={[6, 6, 0, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-gradient-to-r from-pos/10 to-neg/10 border border-white/5 p-4 rounded-inner flex items-center justify-around mt-4">
                        <div className="text-center">
                          <p className="text-xs text-ink-2 mb-1 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3 text-pos"/> Receitas Total</p>
                          <p className="font-bold text-pos">{formatMoney(Number(balanceData.reduce((a: number, b: any) => a + b.Receitas, 0)))}</p>
                        </div>
                        <div className="w-px h-10 bg-white/10"></div>
                        <div className="text-center">
                          <p className="text-xs text-ink-2 mb-1 flex items-center justify-center gap-1"><TrendingDown className="w-3 h-3 text-neg"/> Despesas Total</p>
                          <p className="font-bold text-neg">{formatMoney(Number(balanceData.reduce((a: number, b: any) => a + b.Despesas, 0)))}</p>
                        </div>
                        <div className="w-px h-10 bg-white/10"></div>
                        <div className="text-center">
                          <p className="text-xs text-ink-2 mb-1 flex items-center justify-center gap-1"><PiggyBank className="w-3 h-3 text-brand"/> Investido</p>
                          <p className="font-bold text-brand">{formatMoney(Number(balanceData.reduce((a: number, b: any) => a + (b.Investido || 0), 0)))}</p>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

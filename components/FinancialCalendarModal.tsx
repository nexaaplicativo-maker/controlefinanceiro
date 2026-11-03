"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney } from "../lib/format";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function FinancialCalendarModal({ isOpen, onClose, transactions }: { isOpen: boolean, onClose: () => void, transactions: any[] }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Agrupar transações por dia
  const transactionsByDay = useMemo(() => {
    const map: Record<number, { income: number, expense: number, items: any[] }> = {};
    
    transactions.forEach(t => {
      if (!t.date) return;
      const tDate = new Date(t.date);
      // Ensure the transaction is in the current viewed month
      // using UTC approach to avoid timezone shifts if date is YYYY-MM-DD
      const [yearStr, monthStr, dayStr] = t.date.split('-');
      if (!yearStr || !monthStr || !dayStr) return;
      
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1;
      const day = parseInt(dayStr);

      if (year === currentDate.getFullYear() && month === currentDate.getMonth()) {
        if (!map[day]) {
          map[day] = { income: 0, expense: 0, items: [] };
        }
        if (t.type === 'income') {
          map[day].income += t.amount;
        } else {
          map[day].expense += t.amount;
        }
        map[day].items.push(t);
      }
    });
    return map;
  }, [transactions, currentDate]);

  const [selectedDay, setSelectedDay] = useState<number | null>(null);


  const renderDays = () => {
    const days = [];
    // Espaços vazios no início
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 sm:h-24 bg-white/[0.02] rounded-field border border-white/5 opacity-50"></div>);
    }
    
    // Dias do mês
    for (let i = 1; i <= daysInMonth; i++) {
      const data = transactionsByDay[i];
      const isToday = new Date().getDate() === i && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
      const isSelected = selectedDay === i;

      days.push(
        <div 
          key={i} 
          onClick={() => data ? setSelectedDay(isSelected ? null : i) : null}
          className={`h-20 sm:h-24 rounded-field border p-1.5 sm:p-2 flex flex-col transition-all cursor-pointer overflow-hidden ${
            isSelected ? 'bg-brand/20 border-brand shadow-[0_0_15px_rgba(99,102,241,0.2)]' :
            isToday ? 'bg-white/10 border-white/20' : 
            'bg-white/5 border-white/10 hover:bg-white/5'
          } ${!data ? 'opacity-70 cursor-default' : ''}`}
        >
          <div className="flex justify-between items-start mb-auto">
            <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-brand text-canvas' : 'text-ink-2'}`}>
              {i}
            </span>
          </div>

          {data && (
            <div className="flex flex-col gap-0.5 sm:gap-1 mt-1">
              {data.income > 0 && (
                <div className="flex items-center gap-1 text-xs sm:text-xs text-pos bg-pos/10 px-1 py-0.5 rounded-md truncate">
                  <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 shrink-0" /> <span className="truncate">{formatMoney(data.income)}</span>
                </div>
              )}
              {data.expense > 0 && (
                <div className="flex items-center gap-1 text-xs sm:text-xs text-neg bg-neg/10 px-1 py-0.5 rounded-md truncate">
                  <TrendingDown className="w-2 h-2 sm:w-3 sm:h-3 shrink-0" /> <span className="truncate">{formatMoney(data.expense)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-5xl h-[95vh] sm:h-[90vh] sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-4 sm:p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand/20 text-brand rounded-field flex items-center justify-center border border-brand/30">
                  <CalendarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink">Calendário Financeiro</h2>
                  <p className="text-sm text-ink-2">Visão mensal do seu fluxo de caixa</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-full border border-white/10 mr-2">
                  <button onClick={prevMonth} className="p-2 rounded-full text-ink-2 hover:text-ink transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                  <div className="w-32 text-center font-bold text-sm text-ink tracking-wider uppercase">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </div>
                  <button onClick={nextMonth} className="p-2 rounded-full text-ink-2 hover:text-ink transition-colors cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <button onClick={onClose} aria-label="Fechar" className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-y-auto lg:overflow-hidden">
              
              <div className="flex-1 flex flex-col min-w-0">
                <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 shrink-0">
                  {weekDays.map(day => (
                    <div key={day} className="text-center text-xs font-semibold text-ink-3">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 overflow-y-auto pb-4 pr-1">
                  {renderDays()}
                </div>
              </div>

              {selectedDay !== null && transactionsByDay[selectedDay] && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-80 shrink-0 bg-white/5 border border-white/10 rounded-inner p-4 flex flex-col h-full max-h-[400px] lg:max-h-full">
                  <h3 className="font-bold text-ink mb-4 border-b border-white/10 pb-3 flex justify-between items-center">
                    <span>Lançamentos do dia {selectedDay}</span>
                    <button onClick={() => setSelectedDay(null)} className="p-1 rounded-md text-ink-3 hover:bg-white/10 hover:text-ink transition-colors lg:hidden"><X className="w-4 h-4"/></button>
                  </h3>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1">
                    {transactionsByDay[selectedDay].items.map((t: any, idx: number) => (
                      <div key={idx} className="bg-black/30 border border-white/5 p-3 rounded-field flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-pos/10 text-pos' : 'bg-neg/10 text-neg'}`}>
                            {t.type === 'income' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink truncate">{t.title}</p>
                            <p className="text-xs text-ink-3 uppercase tracking-wide truncate">{t.category}</p>
                          </div>
                        </div>
                        <div className={`text-sm font-bold shrink-0 ml-2 ${t.type === 'income' ? 'text-pos' : 'text-neg'}`}>
                          {t.type === 'income' ? '+' : '-'} {formatMoney(t.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2 shrink-0">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-2">Total Receitas</span>
                      <span className="text-pos font-medium">{formatMoney(transactionsByDay[selectedDay].income)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-2">Total Despesas</span>
                      <span className="text-neg font-medium">{formatMoney(transactionsByDay[selectedDay].expense)}</span>
                    </div>
                    <div className="flex justify-between font-bold mt-1 pt-1 border-t border-white/5">
                      <span className="text-ink">Saldo do Dia</span>
                      <span className={transactionsByDay[selectedDay].income - transactionsByDay[selectedDay].expense >= 0 ? 'text-pos' : 'text-neg'}>
                        {formatMoney(transactionsByDay[selectedDay].income - transactionsByDay[selectedDay].expense)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

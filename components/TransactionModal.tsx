"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, TrendingUp, TrendingDown, Calendar, Wallet, ChevronDown, AlertTriangle, Sparkles } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { validateText, validateMoney, validateDate, validateInteger, firstError } from "../lib/validation";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { SUBCATEGORIAS, subcategoriaSugerida } from "../lib/subcategorias";
import { AI_ENABLED } from "../lib/features";

export function TransactionModal({ isOpen, onClose, onSave, onImportarFatura }: { isOpen: boolean, onClose: () => void, onSave?: () => void, onImportarFatura?: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Variáveis");
  const [date, setDate] = useState("");
  
  const [isInstallment, setIsInstallment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  // Vazio = deduzir pela descrição no momento de salvar. Deixar explícito na
  // tela é melhor que classificar por trás: a pessoa vê o que vai acontecer.
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [installments, setInstallments] = useState(1);
  const [isSplit, setIsSplit] = useState(false);
  const [isPaid, setIsPaid] = useState(true);
  
  const [wallets, setWallets] = useState<any[]>([]);
  const [walletId, setWalletId] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      fetchData();
    }
  }, [isOpen]);

  async function fetchData() {
    const userId = await getUserId();
    if (!userId) {
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    const [catRes, walRes] = await Promise.all([
      supabase.from('categories').select('*').eq('user_id', userId).order('name'),
      supabase.from('wallets').select('*').eq('user_id', userId).order('name')
    ]);
    
    if (catRes.data) setCustomCategories(catRes.data);
    if (walRes.data && walRes.data.length > 0) {
      setWallets(walRes.data);
      setWalletId(walRes.data[0].id);
    }
  }

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    setCategory(newType === 'expense' ? 'Variáveis' : 'Salário');
    if (newType === 'income') {
      setIsInstallment(false);
      setIsSplit(false);
      setIsPaid(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Antes só checava se os campos estavam preenchidos. Dava para gravar
    // R$ 999.999.999.999, um título com 2.000 caracteres ou uma data em 1900 —
    // nada disso derruba o app, mas tudo isso distorce as medianas que
    // alimentam o diagnóstico inteiro.
    const vTitulo = validateText(title, 'título');
    const vValor = validateMoney(amount, 'valor');
    const vData = validateDate(date);
    const vParcelas = isInstallment
      ? validateInteger(installments, 'número de parcelas', { min: 2, max: 48 })
      : { ok: true as const, error: null };

    const erro = firstError(vTitulo, vValor, vData, vParcelas);
    if (erro) { toast(erro, "warning"); return; }

    setIsLoading(true);

    try {
      const userId = await getUserId();
      const baseAmount = vValor.value as number;
      
      // Guarda o CAMINHO do arquivo, não uma URL pública.
      // Antes isto gravava o resultado de getPublicUrl(): um link permanente e
      // sem autenticação para um comprovante financeiro. URL vaza por
      // histórico, log e compartilhamento — e uma vez vazada, vale para sempre.
      // Agora a URL é assinada na hora de abrir, com validade curta.
      let receiptPath = null;
      if (receiptFile && userId) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage.from('receipts').upload(fileName, receiptFile);
        if (!uploadError && data) {
          receiptPath = data.path;
        } else if (uploadError) {
          toast("Não consegui anexar o comprovante, mas o lançamento foi salvo.", "warning");
        }
      }

      const transactionsToInsert = [];
      const installmentGroup = isInstallment && installments > 1 ? crypto.randomUUID() : null;

      const startDate = new Date(date);
      // Ajusta timezone offset para evitar bug de data
      startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());

      let loopCount = (isInstallment || isRecurring) && type === 'expense' ? installments : 1;
      let amountPerInstallment = baseAmount;
      if (isSplit && type === 'expense') amountPerInstallment = amountPerInstallment / 2;

      for (let i = 0; i < loopCount; i++) {
        const currentInstallmentDate = new Date(startDate);
        currentInstallmentDate.setMonth(currentInstallmentDate.getMonth() + i);
        
        let finalTitle = title;
        if (isInstallment) finalTitle = `${title} (${i+1}/${installments})`;
        if (isSplit && type === 'expense') finalTitle = `${finalTitle} 👩‍❤️‍👨`;
        
        transactionsToInsert.push({
          title: finalTitle,
          amount: amountPerInstallment,
          type: type,
          category: category,
          // Receita não tem "onde foi gasto". Despesa sem escolha explícita
          // cai no palpite local pela descrição, que é de graça.
          subcategoria: type === 'expense'
            ? (subcategoria || subcategoriaSugerida(finalTitle))
            : null,
          date: currentInstallmentDate.toISOString().split('T')[0],
          installment_group: installmentGroup,
          installment_info: isInstallment ? `${i+1}/${installments}` : null,
          is_split: isSplit && type === 'expense',
          is_paid: i === 0 ? isPaid : false,
          user_id: userId,
          wallet_id: walletId || null,
          receipt_url: receiptPath
        });
      }

      const { error } = await supabase.from('transactions').insert(transactionsToInsert);

      if (error) throw error;

      toast("🎉 Lançamento salvo com sucesso!", "success");
      
      setTitle("");
      setAmount("");
      setIsInstallment(false);
      setIsRecurring(false);
      setInstallments(1);
      setSubcategoria("");
      setIsSplit(false);
      setIsPaid(true);
      setReceiptFile(null);
      setDate(new Date().toISOString().split('T')[0]);
      
      onClose();
      if (onSave) onSave();
      
    } catch (error: any) {
      console.error(error);
      toast("Erro ao salvar: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-ink">Novo Lançamento</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto [&>*]:shrink-0 pr-2 pb-4">
              
              <div className="flex gap-2 p-1 bg-white/5 rounded-inner border border-white/10 shrink-0">
                <button type="button" onClick={() => handleTypeChange('expense')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-field text-sm font-medium transition-colors ${type === 'expense' ? 'bg-neg/20 text-neg border border-neg/30' : 'text-ink-2 hover:text-ink'}`}>
                  <TrendingDown className="w-4 h-4" /> Despesa
                </button>
                <button type="button" onClick={() => handleTypeChange('income')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-field text-sm font-medium transition-colors ${type === 'income' ? 'bg-pos/20 text-pos border border-pos/30' : 'text-ink-2 hover:text-ink'}`}>
                  <TrendingUp className="w-4 h-4" /> Receita
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">{isInstallment ? "Valor da Parcela" : "Valor Total"}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 font-medium">R$</span>
                  <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-12 pr-4 text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">Título</label>
                <input type="text" placeholder="Ex: Conta de Luz, Supermercado..." value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field p-3 text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors" />
              </div>

              <div className="flex gap-4">

                <div className="flex-1">
                  <label className="block text-sm font-medium text-ink-2 mb-1.5">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-10 pr-3 text-ink focus:outline-none focus:border-brand transition-colors [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-ink-2 mb-1.5">Categoria</label>
                  <div className="relative">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-4 pr-10 text-ink focus:outline-none focus:border-brand transition-colors appearance-none cursor-pointer">
                      {type === 'expense' ? (
                      <>
                        <option value="Variáveis">Variáveis</option>
                        <option value="Contas Fixas">Contas Fixas</option>
                        <option value="Cartões">Cartões de Crédito</option>
                        {/* Aporte é saída de conta, não receita: o dinheiro deixa
                            o saldo e vira patrimônio. O painel já desconta esta
                            categoria da Capacidade de Poupança e a tela de edição
                            já a oferecia — só o formulário de criar não tinha,
                            então dava para EDITAR um lançamento para aporte, mas
                            não para criar um. O aviso logo abaixo até oferece
                            "Mudar para Despesa", levando a um estado que este
                            campo não alcançava. */}
                        <option value="Investimentos">Investimentos</option>
                        {customCategories.filter(c => c.type === 'expense').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </>
                    ) : (
                      <>
                        <option value="Salário">Salário</option>
                        <option value="Investimentos">Investimentos</option>
                        <option value="Outros">Outros</option>
                        {customCategories.filter(c => c.type === 'income').map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </>
                    )}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                  </div>

                  {/* Receita + Investimentos é quase sempre engano: quem compra
                      um ativo está tirando dinheiro da conta, não recebendo.
                      Só faz sentido em venda ou resgate. */}
                  {type === 'income' && category === 'Investimentos' && (
                    <div className="mt-3 flex items-start gap-2.5 bg-warn/5 border border-warn/20 rounded-field p-3">
                      <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <p className="text-warn font-semibold mb-1">Isso é uma venda ou resgate?</p>
                        <p className="text-ink-2">
                          Se você está <strong className="text-ink-2">comprando</strong> um ativo, o certo é lançar como <strong className="text-ink-2">Despesa</strong> — o dinheiro sai da conta e vira patrimônio.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setType('expense'); setCategory('Investimentos'); }}
                          className="mt-2 text-warn hover:text-warn font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Mudar para Despesa
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {wallets.length > 0 && (
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-ink-2 mb-1.5">Carteira</label>
                    <div className="relative">
                      <select value={walletId} onChange={(e) => setWalletId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-4 pr-10 text-ink focus:outline-none focus:border-brand transition-colors appearance-none cursor-pointer">
                        {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              {type === 'expense' && (
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1.5">
                    Onde foi o gasto <span className="text-ink-3 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-4 pr-10 text-ink focus:outline-none focus:border-brand transition-colors appearance-none cursor-pointer">
                      <option value="">Deduzir pela descrição</option>
                      {SUBCATEGORIAS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                  </div>
                  <p className="text-xs text-ink-3 mt-1.5">
                    Serve para ver quanto foi em cada coisa no mês. Não altera o orçamento, que segue por categoria.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">Comprovante (Opcional)</label>
                <input type="file" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} className="w-full bg-white/5 border border-white/10 rounded-field py-2 px-3 text-sm text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand/20 file:text-brand hover:file:bg-brand/30 transition-colors cursor-pointer" />

                {/* Anexar a fatura aqui só guarda o arquivo: nada dentro dele é
                    lido, e o gasto vira um item único. Quem fez isso achou que
                    tinha importado a fatura. O campo precisa dizer. */}
                {receiptFile?.type === 'application/pdf' && (
                  <div className="mt-2.5 flex items-start gap-2.5 bg-brand/5 border border-brand/20 rounded-field p-3">
                    <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed">
                      <p className="text-brand font-semibold mb-1">Isso é uma fatura?</p>
                      <p className="text-ink-2">
                        Aqui o PDF fica só guardado como comprovante, e o lançamento vira <strong className="text-ink-2">um item único</strong>.
                        {AI_ENABLED && onImportarFatura
                          ? ' Para separar compra por compra, use a leitura por IA.'
                          : ' A leitura automática está desligada, então as compras não serão separadas.'}
                      </p>
                      {/* Sem a flag não existe leitura por IA: oferecer o botão
                          levaria a um modal que só devolve 503. */}
                      {AI_ENABLED && onImportarFatura && (
                        <button
                          type="button"
                          onClick={onImportarFatura}
                          className="mt-2 text-brand hover:text-brand font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Ler a fatura e separar as compras
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {type === 'expense' && (
                <div className="bg-white/5 border border-white/10 rounded-field p-4 flex flex-col gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isInstallment} onChange={(e) => { setIsInstallment(e.target.checked); setIsRecurring(false); }} className="w-5 h-5 rounded border-white/20 bg-white/5 text-brand focus:ring-brand focus:ring-offset-neutral-900" />
                    <span className="text-ink font-medium">Compra Parcelada?</span>
                  </label>
                  
                  {isInstallment && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-3">
                      <span className="text-ink-2 text-sm">Em</span>
                      <input type="number" min="2" max="48" value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-20 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-ink focus:outline-none focus:border-brand" />
                      <span className="text-ink-2 text-sm">vezes</span>
                    </motion.div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isRecurring} onChange={(e) => { setIsRecurring(e.target.checked); setIsInstallment(false); }} className="w-5 h-5 rounded border-white/20 bg-white/5 text-neg focus:ring-neg focus:ring-offset-neutral-900" />
                    <span className="text-ink font-medium">Conta Mensal Fixa (Repetir)?</span>
                  </label>
                  
                  {isRecurring && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-3">
                      <span className="text-ink-2 text-sm">Repetir por</span>
                      <input type="number" min="2" max="48" value={installments} onChange={(e) => setInstallments(parseInt(e.target.value))} className="w-20 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-ink focus:outline-none focus:border-brand" />
                      <span className="text-ink-2 text-sm">meses</span>
                    </motion.div>
                  )}

                  <div className="h-px bg-white/10 w-full"></div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isSplit} onChange={(e) => setIsSplit(e.target.checked)} className="w-5 h-5 rounded border-white/20 bg-white/5 text-ink-2 focus:ring-brand focus:ring-offset-neutral-900" />
                    <div>
                      <span className="text-ink font-medium block">Dividir com Parceiro(a)?</span>
                      <span className="text-ink-3 text-xs">A despesa será cortada pela metade (50/50).</span>
                    </div>
                  </label>

                  <div className="h-px bg-white/10 w-full"></div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="w-5 h-5 rounded border-white/20 bg-white/5 text-pos focus:ring-pos focus:ring-offset-neutral-900" />
                    <div>
                      <span className="text-ink font-medium block">Já foi pago?</span>
                      <span className="text-ink-3 text-xs">Desmarque se for uma conta para o futuro.</span>
                    </div>
                  </label>
                </div>
              )}

              <button type="submit" disabled={isLoading} className="w-full mt-2 bg-brand hover:bg-brand-strong disabled:bg-brand/50 text-canvas font-medium py-3.5 rounded-field transition-all shadow-lg shadow-brand/25 active:scale-[0.98] flex justify-center items-center shrink-0">
                {isLoading ? "Salvando..." : "Salvar Lançamento"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

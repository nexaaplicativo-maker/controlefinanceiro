/**
 * Saudação do cabeçalho: hora do dia e primeiro nome.
 *
 * POR QUE SAIU DE `app/page.tsx`
 * A saudação lia `new Date()` por conta própria, dentro do componente. Não
 * havia como provar a virada de meio-dia sem mexer no relógio da máquina — e
 * a única regra que a tela tinha ("antes do meio-dia é bom dia") ficava
 * escondida no meio de 2.100 linhas de JSX.
 *
 * POR QUE O E-MAIL NÃO APARECE MAIS
 * O cabeçalho mostrava `userEmail.split('@')[0]` como se fosse o nome da
 * pessoa — "souza.higor" — e caía em "Usuário" quando nem isso existia.
 * Nenhum dos dois é nome: o primeiro é um endereço cortado ao meio, o segundo
 * é um rótulo de banco de dados. Sem nome de verdade a saudação fica sozinha
 * ("Bom dia"), que é honesto e não precisa de dado nenhum.
 *
 * O nome só vai existir quando o app passar a coletá-lo (cadastro ou perfil).
 * Até lá `primeiroNome` recebe null e devolve string vazia, e quem monta a
 * linha decide a pontuação: com nome é "Bom dia, Higor"; sem nome é "Bom dia",
 * nunca "Bom dia,".
 */

/**
 * Saudação para uma hora do dia.
 *
 * `hora` é o que `Date.getHours()` devolve: 0 a 23. Os cortes são 12 e 18,
 * ou seja, 11h59 ainda é manhã e 18h00 já é noite.
 */
export function saudacaoPorHora(hora: number): string {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

/**
 * Saudação pelo relógio local de quem está olhando a tela.
 *
 * `agora` é parâmetro só para o teste poder fixar a data — em produção
 * ninguém passa nada.
 */
export function saudacao(agora: Date = new Date()): string {
  return saudacaoPorHora(agora.getHours());
}

/** "LUÍSA" -> "Luísa". Um segmento, sem separador dentro. */
function capitalizarSegmento(segmento: string): string {
  if (!segmento) return segmento;
  return (
    segmento.charAt(0).toLocaleUpperCase('pt-BR') +
    segmento.slice(1).toLocaleLowerCase('pt-BR')
  );
}

/**
 * Primeiro nome, capitalizado.
 *
 * Devolve `''` — e não um nome de mentira — quando não há o que mostrar:
 * null, undefined, vazio ou só espaços. Quem chama trata a string vazia como
 * "não tenho nome desta pessoa".
 *
 * O hífen é tratado como parte do nome, não como separador de palavras:
 * "ana-luísa" vira "Ana-Luísa" e continua sendo UM primeiro nome. Só o espaço
 * separa primeiro nome de sobrenome.
 */
export function primeiroNome(nomeDoPerfil: string | null | undefined): string {
  const primeiro = (nomeDoPerfil ?? '').trim().split(/\s+/)[0] ?? '';
  if (!primeiro) return '';
  return primeiro.split('-').map(capitalizarSegmento).join('-');
}

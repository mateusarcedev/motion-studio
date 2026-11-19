/**
 * Classifies WHAT KIND of visual resource an intent needs (never which library).
 * Returns ordered kind groups; the session tries them in order and falls back to a generated glyph.
 */
import { normalize } from "./resolver.mjs";

const RX = {
  lottie: /\b(lottie|dotlottie)\b/,
  animated: /\b(animad[oa]s?|animation|animated|animacao|animar|movimento no icone)\b/,
  character: /\b(personagem|personagens|character|characters|pessoa|pessoas|people|person|humano|humanos|human|gente)\b/,
  illustration: /\b(ilustracao|ilustracoes|illustration|illustrations|cena|scene|hero image|imagem de capa)\b/,
  logo: /\b(logo|logotipo|tecnologia|tecnologias|stack|linguagem|framework|banco de dados|developer|ferramenta de desenvolvimento)\b/,
};
const MIN_SCORE = { logo: 20, character: 8, illustration: 8, lottie: 6, "animated-icon": 4, icon: 4 };

export function classifyNeed(intent, { kinds } = {}) {
  const n = normalize(intent);
  let groups;
  const reasons = [];
  if (kinds?.length) { groups = kinds.map((k) => [k]); reasons.push("tipo definido pelo diretor"); }
  else if (RX.lottie.test(n)) { groups = [["lottie"], ["animated-icon", "icon"]]; reasons.push("pedido de animação Lottie"); }
  else if (RX.animated.test(n)) { groups = [["logo"], ["lottie"], ["animated-icon"], ["icon"]]; reasons.push("pedido de animação (Lottie se houver correspondência; senão ícone animado)"); }
  else if (RX.character.test(n)) { groups = [["character"], ["illustration"], ["icon"]]; reasons.push("pessoas/personagens"); }
  else if (RX.illustration.test(n)) { groups = [["illustration"], ["character"], ["icon"]]; reasons.push("ilustração"); }
  else { groups = [["logo"], ["icon"]]; reasons.push("pictograma (logo só se uma tecnologia for citada)"); }
  return { groups, minScore: MIN_SCORE, reasons };
}

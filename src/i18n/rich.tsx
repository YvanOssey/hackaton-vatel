import { Fragment } from "react";

/**
 * Insère des éléments React dans une phrase déjà traduite :
 * rich(t("Envoyé au {phone} via {provider}."), { phone: <strong>…</strong>, provider: "Wave" })
 */
export function rich(text: string, nodes: Record<string, React.ReactNode>) {
  return text.split(/(\{\w+\})/g).map((part, i) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return <Fragment key={i}>{m && m[1] in nodes ? nodes[m[1]] : part}</Fragment>;
  });
}

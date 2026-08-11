export const metadata = { title: "Exclusão de Dados — Mesus Track" };

export default function DataDeletionPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 prose prose-neutral dark:prose-invert">
      <h1>Solicitação de Exclusão de Dados</h1>

      <p>
        Para solicitar a exclusão dos seus dados pessoais do Mesus Track, envie um e-mail para{" "}
        <a href="mailto:gestor.lucasmedeiros@gmail.com">gestor.lucasmedeiros@gmail.com</a> com o
        assunto <strong>"Exclusão de dados"</strong> e seu número de telefone ou nome completo.
      </p>

      <p>Sua solicitação será processada em até 15 dias úteis.</p>

      <h2>O que será excluído</h2>
      <ul>
        <li>Dados de identificação (nome, telefone)</li>
        <li>Histórico de leads e interações</li>
        <li>Dados de atribuição de anúncios</li>
      </ul>

      <p>
        Após a exclusão, você receberá uma confirmação por e-mail.
      </p>
    </main>
  );
}

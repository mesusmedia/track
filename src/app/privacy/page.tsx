export const metadata = { title: "Política de Privacidade — Mesus Track" };

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 prose prose-neutral dark:prose-invert">
      <h1>Política de Privacidade</h1>
      <p><strong>Última atualização:</strong> agosto de 2026</p>

      <h2>1. Quem somos</h2>
      <p>
        Mesus Track é uma plataforma de rastreamento e CRM para agências de marketing digital,
        operada pela Mesus Media. Contato: gestor.lucasmedeiros@gmail.com
      </p>

      <h2>2. Dados coletados</h2>
      <p>
        Coletamos dados de leads (nome, telefone, origem do anúncio) enviados pelas plataformas
        de anúncios (Meta, Google) e pelo WhatsApp Business API, exclusivamente para fins de
        rastreamento de conversões e gestão de relacionamento com clientes das agências usuárias.
      </p>

      <h2>3. Uso dos dados</h2>
      <ul>
        <li>Atribuição de leads a campanhas de anúncios</li>
        <li>Disparo de eventos de conversão (Meta CAPI, Google Ads)</li>
        <li>Gestão de funil de vendas (CRM)</li>
      </ul>

      <h2>4. Compartilhamento</h2>
      <p>
        Dados não são vendidos a terceiros. São compartilhados apenas com as plataformas de
        anúncios (Meta, Google) para fins de otimização de campanhas, conforme autorização do
        anunciante.
      </p>

      <h2>5. Retenção</h2>
      <p>Dados de leads são retidos por até 24 meses ou até solicitação de exclusão.</p>

      <h2>6. Seus direitos</h2>
      <p>
        Para solicitar acesso, correção ou exclusão dos seus dados, acesse{" "}
        <a href="/data-deletion">track.mesusmedia.com.br/data-deletion</a> ou envie e-mail para
        gestor.lucasmedeiros@gmail.com.
      </p>
    </main>
  );
}

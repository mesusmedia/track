export default function ClienteConversasPage() {
  const chatwootUrl = process.env.CHATWOOT_BASE_URL;

  if (!chatwootUrl) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Central de conversas não configurada. Contate sua agência.
      </div>
    );
  }

  return (
    // Cancela o p-6 do layout para o iframe ocupar toda a área disponível
    <div className="-m-6 h-[calc(100vh-3.5rem)]">
      <iframe
        src={chatwootUrl}
        className="w-full h-full border-0"
        allow="microphone; camera"
        title="Central de Conversas"
      />
    </div>
  );
}

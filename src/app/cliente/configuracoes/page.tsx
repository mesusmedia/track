import { redirect } from "next/navigation";

// Configuracoes fica so com o admin da agencia (gerenciado em
// /admin/clients/[id]/configuracoes) -- o layout de /cliente ja garante que
// só usuario role "client" chega aqui, entao desativa a pagina pra todos.
export default async function ClienteConfigPage() {
  redirect("/cliente");
}

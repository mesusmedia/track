import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClienteHomePage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visão geral</CardTitle>
        <CardDescription>Seu dashboard de tracking e CRM</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary">Sem dados ainda — chega na Fase 2</Badge>
      </CardContent>
    </Card>
  );
}

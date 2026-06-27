import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { loadCampaigns } from "@/lib/dashboard/load";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CampaignsView({ data }: { data: Awaited<ReturnType<typeof loadCampaigns>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campanhas</CardTitle>
        <CardDescription>
          Receita por campanha (UTM), a partir das vendas pagas.
          {data.hasMetaAdsConfigured && (
            <span className="block mt-1">
              <Badge variant="secondary">
                ROAS/CPA com gasto do Meta Ads ainda não disponível — precisa de campaign_id
                capturado no clique, não só o nome da UTM
              </Badge>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda com UTM registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.campaigns.map((c) => (
                <TableRow key={c.campaign}>
                  <TableCell className="font-medium">{c.campaign}</TableCell>
                  <TableCell className="font-mono tabular-nums">{c.sales}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatBRL(c.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

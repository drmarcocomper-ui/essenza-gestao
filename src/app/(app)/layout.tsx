import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

/**
 * Shell do app: header com o título da seção e nav fixa no rodapé.
 * O middleware já garante que só chega aqui quem tem sessão.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // flex-1 (e não só min-h-full) para o fundo cobrir a tela toda dentro do
    // body, que é flex-col.
    <div className="flex min-h-full flex-1 flex-col bg-neutral-50">
      <AppHeader />

      {/* pb-20 + safe-area: conteúdo nunca fica sob a BottomNav (h-14). */}
      <main className="mx-auto w-full max-w-screen-sm flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}

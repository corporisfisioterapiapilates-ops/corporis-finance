import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Configure E2E_EMAIL e E2E_PASSWORD para rodar e2e.");

test.beforeEach(async () => {
  await cleanupE2ENotifications();
  await cleanupE2ETransactions();
  await cleanupE2EBudget();
});

test.afterEach(async () => {
  await cleanupE2ENotifications();
  await cleanupE2ETransactions();
  await cleanupE2EBudget();
});

test("login, novo lançamento e DFC carregam com dados atualizados", async ({ page }) => {
  const marker = `E2E Pilates ${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);

  await login(page);

  await page.goto("/lancamentos");
  await page.getByRole("button", { name: "Novo Lançamento" }).last().click();
  await page.getByPlaceholder("R$ 0,00").fill("123,45");
  await page.keyboard.press("Tab");
  await page.locator('input[type="date"]').nth(0).fill(today);
  await page.locator('input[type="date"]').nth(1).fill(today);
  await page.getByPlaceholder("Ex: Aula de Pilates - Ana Souza").fill(marker);

  const categorySelect = page.locator("aside select").last();
  if ((await categorySelect.inputValue()) === "") {
    await categorySelect.selectOption({ index: 1 });
  }

  await page.getByRole("button", { name: "Salvar lançamento" }).click();
  await expect(page.getByText(marker)).toBeVisible();

  await page.goto("/dfc");
  await expect(page.getByRole("main").getByRole("heading", { name: "DFC" })).toBeVisible();
  await expect(page.getByText("Desp. Totais")).toBeVisible();
  await expect(page.getByText("Saldo Atual")).toBeVisible();
});

test("upload de CSV, conciliação e confirmação atualizam lançamentos", async ({ page }) => {
  const marker = `E2E Import Mensalidade Pilates ${Date.now()}`;
  const filename = `e2e-import-${Date.now()}.csv`;
  const csv = `Data,Descrição,Valor\n24/05/2026,${marker},"234,56"`;

  await login(page);

  await page.goto("/importacoes");
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });

  await expect(page.getByText(filename)).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();
  const confirmButton = page.getByRole("button", { name: "Confirmar 1 lançamentos" });
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();
  await expect(page.getByText("1 lançamentos importados.")).toBeVisible();

  await page.goto("/lancamentos");
  await page.getByPlaceholder("Buscar por descrição...").fill(marker);
  await expect(page.getByText(marker)).toBeVisible();
});

test("orçamento salvo aparece no Orçado x Realizado", async ({ page }) => {
  await login(page);

  await page.goto("/orcamento/editor?year=2099");
  await expect(page.getByRole("heading", { name: "orçamento anual" })).toBeVisible();
  const firstBudgetInput = page.locator('input[placeholder="0,00"]').first();
  await firstBudgetInput.fill("1000,00");
  await firstBudgetInput.blur();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Orçamento salvo.")).toBeVisible();

  await page.goto("/orcamento?month=2099-01");
  await expect(
    page.getByRole("main").getByRole("heading", { name: "orçado x realizado" }),
  ).toBeVisible();
  await expect(page.getByText("Orçado: R$ 1.000,00").first()).toBeVisible();
});

test("sino lista notificação não lida e permite marcar todas como lidas", async ({ page }) => {
  const marker = `E2E Notification Mensalidade ${Date.now()}`;
  const filename = `e2e-notification-${Date.now()}.csv`;
  const csv = `Data,Descrição,Valor\n24/05/2026,${marker},"345,67"`;

  await login(page);

  await page.goto("/importacoes");
  await page.locator('input[type="file"][accept=".csv"]').setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(csv, "utf8"),
  });
  await expect(page.getByText(filename)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /notificações não lidas/i })).toBeVisible();

  await page.getByRole("button", { name: /notificações não lidas/i }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(`Importação aguardando revisão.*${filename}`) }),
  ).toBeVisible();
  await expect(page.getByText(filename)).toBeVisible();

  await page.getByRole("button", { name: "Marcar lidas" }).click();
  await expect(page.getByRole("button", { name: "Notificações" })).toBeVisible();
});

async function login(page: import("@playwright/test").Page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error("Configure E2E_EMAIL e E2E_PASSWORD para rodar e2e.");
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(E2E_EMAIL);
  await page.getByRole("textbox", { name: "Senha" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Entrar na Corporis" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function cleanupE2ETransactions() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await supabase.from("transactions").delete().like("description", "E2E Pilates %");
  await supabase.from("transactions").delete().like("description", "E2E Import %");
  await supabase.from("imports").delete().like("filename", "e2e-import-%");
}

async function cleanupE2ENotifications() {
  const client = getServiceClient();
  if (!client) return;

  const context = await getE2EContext();
  if (!context) return;

  await client.from("notifications").delete().eq("organization_id", context.organizationId);
  await client.from("imports").delete().like("filename", "e2e-notification-%");
}

async function cleanupE2EBudget() {
  const supabase = getServiceClient();
  if (!supabase) return;

  await supabase.from("budget_versions").delete().eq("year", 2099);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getE2EContext() {
  const supabase = getServiceClient();
  if (!supabase) return null;

  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users.users.find((item) => item.email === E2E_EMAIL);
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .neq("type", "credit_card")
    .limit(1)
    .single();

  return account?.id
    ? { userId: user.id, organizationId: profile.organization_id, accountId: account.id }
    : null;
}

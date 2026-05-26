"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Plus,
  Search,
  Trash2,
  UnfoldVertical,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import {
  type ChartAccountActionResult,
  createChartAccountChild,
  deleteChartAccount,
  updateChartAccount,
} from "@/actions/chart-of-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildChartAccountTree,
  type ChartAccount,
  type ChartAccountNature,
  type ChartAccountNode,
  type CostClassification,
  flattenChartAccountTree,
  getGroupNumber,
} from "@/lib/dfc";
import { cn } from "@/lib/utils";

type ChartOfAccountsManagerProps = {
  accounts: ChartAccount[];
};

type EditableFields = {
  name: string;
  nature: ChartAccountNature;
  cost_classification: CostClassification | null;
  is_active: boolean;
};

const GROUP_SWATCH: Record<string, string> = {
  "1": "bg-green",
  "2": "bg-beige",
  "3": "bg-danger/70",
  "4": "bg-danger",
  "5": "bg-ink-secondary",
  "6": "bg-beige-light",
  "7": "bg-beige",
  "8": "bg-orange/60",
};

const NATURE_LABEL: Record<ChartAccountNature, string> = {
  income: "Entrada",
  expense: "Saída",
  transfer: "Transfer.",
  calculated: "Calculado",
};

const NATURE_STYLE: Record<ChartAccountNature, string> = {
  income: "bg-success-soft text-success",
  expense: "bg-danger-soft text-danger",
  transfer: "bg-orange-soft text-orange",
  calculated: "bg-[#F0EEE9] text-ink-secondary",
};

const CLASSIFICATION_LABEL: Record<CostClassification, string> = {
  fixed: "Fixo",
  variable: "Variável",
};

export function ChartOfAccountsManager({ accounts }: ChartOfAccountsManagerProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(accounts.map((account) => account.id)),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditableFields>>(() =>
    Object.fromEntries(accounts.map((account) => [account.id, toEditableFields(account)])),
  );
  const [newChildParentId, setNewChildParentId] = useState<string | null>(null);
  const [newChildName, setNewChildName] = useState("");
  const [notice, setNotice] = useState<ChartAccountActionResult | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ChartAccount | null>(null);
  const [isPending, startTransition] = useTransition();

  const tree = useMemo(() => buildChartAccountTree(accounts), [accounts]);
  const visibleTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const flatAccounts = useMemo(() => flattenChartAccountTree(tree), [tree]);
  const activeCount = accounts.filter((account) => account.is_active).length;
  const inactiveCount = accounts.length - activeCount;
  const groupCount = accounts.filter((account) => account.parent_id === null).length;

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setExpanded((current) =>
      current.size === flatAccounts.length
        ? new Set(
            accounts.filter((account) => account.parent_id === null).map((account) => account.id),
          )
        : new Set(flatAccounts.map((account) => account.id)),
    );
  }

  function updateDraft(id: string, patch: Partial<EditableFields>) {
    setDrafts((current) => {
      const draft = current[id];
      if (!draft) {
        return current;
      }

      return {
        ...current,
        [id]: { ...draft, ...patch },
      };
    });
  }

  function saveAccount(id: string) {
    const draft = drafts[id];
    if (!draft) {
      return;
    }

    startTransition(async () => {
      const result = await updateChartAccount({ id, ...draft });
      setNotice(result);
      if (result.ok) {
        setEditingId(null);
      }
    });
  }

  function toggleActive(account: ChartAccount) {
    const draft = drafts[account.id] ?? toEditableFields(account);
    const nextDraft = { ...draft, is_active: !draft.is_active };
    updateDraft(account.id, { is_active: nextDraft.is_active });

    startTransition(async () => {
      const result = await updateChartAccount({ id: account.id, ...nextDraft });
      setNotice(result);
    });
  }

  function addChild(parentId: string) {
    if (!newChildName.trim()) {
      setNotice({ ok: false, error: "Informe o nome da nova conta." });
      return;
    }

    startTransition(async () => {
      const result = await createChartAccountChild({ parentId, name: newChildName });
      setNotice(result);
      if (result.ok) {
        setNewChildParentId(null);
        setNewChildName("");
        setExpanded((current) => new Set(current).add(parentId));
      }
    });
  }

  function requestDeleteAccount(account: ChartAccount) {
    setDeleteCandidate(account);
  }

  function confirmDeleteAccount() {
    if (!deleteCandidate) {
      return;
    }

    const account = deleteCandidate;
    startTransition(async () => {
      const result = await deleteChartAccount({ id: account.id });
      setNotice(result);
      if (result.ok) {
        setDeleteCandidate(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center gap-md">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={1.5}
            className="pointer-events-none absolute top-1/2 left-md -translate-y-1/2 text-ink-tertiary"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conta..."
            className="w-[240px] bg-surface pl-[34px] text-body-sm"
          />
        </div>
        <Button type="button" variant="ghost" className="border border-line" onClick={toggleAll}>
          <UnfoldVertical size={14} strokeWidth={1.5} />
          {expanded.size === flatAccounts.length ? "Recolher tudo" : "Expandir tudo"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          title="Grupos novos exigem decisão contábil"
        >
          <FolderPlus size={14} strokeWidth={1.5} />
          Novo grupo
        </Button>
        <Button
          type="button"
          onClick={() => {
            const firstRoot = accounts.find((account) => account.parent_id === null);
            if (firstRoot) {
              setNewChildParentId(firstRoot.id);
            }
          }}
        >
          <Plus size={15} strokeWidth={2} />
          Nova conta
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-lg border border-line bg-surface px-lg py-md text-body-sm text-ink-secondary">
        <span>
          <strong className="text-ink">{activeCount}</strong> contas ativas ·{" "}
          <strong className="text-ink">{groupCount}</strong> grupos ·{" "}
          <span className="text-ink-tertiary">{inactiveCount} inativas</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-md">
          <Legend color="bg-success-soft" label="Entrada" />
          <Legend color="bg-danger-soft" label="Saída" />
          <Legend color="bg-[#F0EEE9]" label="Calculado" />
        </div>
      </div>

      {notice ? (
        <div
          className={cn(
            "rounded-lg border px-md py-sm text-body-sm",
            notice.ok
              ? "border-success/30 bg-success-soft text-success"
              : "border-danger/30 bg-danger-soft text-danger",
          )}
        >
          {notice.ok ? notice.message : notice.error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
        <div className="sticky top-0 z-10 grid min-w-[960px] grid-cols-[38px_40px_76px_minmax(260px,1fr)_104px_132px_76px_160px] items-center border-b-2 border-line bg-sunken">
          <HeaderCell />
          <HeaderCell />
          <HeaderCell>Código</HeaderCell>
          <HeaderCell>Nome</HeaderCell>
          <HeaderCell>Tipo</HeaderCell>
          <HeaderCell>Classificação</HeaderCell>
          <HeaderCell className="text-center">Ativa</HeaderCell>
          <HeaderCell className="pr-lg text-right">Ações</HeaderCell>
        </div>

        <div className="max-h-[calc(100vh-300px)] min-h-[420px] overflow-auto">
          <div className="min-w-[960px]">
            {visibleTree.map((node) => (
              <TreeRows
                key={node.id}
                node={node}
                expanded={expanded}
                editingId={editingId}
                drafts={drafts}
                newChildParentId={newChildParentId}
                newChildName={newChildName}
                isPending={isPending}
                onToggle={toggle}
                onEdit={setEditingId}
                onDraft={updateDraft}
                onSave={saveAccount}
                onCancelEdit={() => setEditingId(null)}
                onToggleActive={toggleActive}
                onPrepareChild={(parentId) => {
                  setNewChildParentId(parentId);
                  setNewChildName("");
                  setExpanded((current) => new Set(current).add(parentId));
                }}
                onNewChildName={setNewChildName}
                onAddChild={addChild}
                onDelete={requestDeleteAccount}
                onCancelChild={() => {
                  setNewChildParentId(null);
                  setNewChildName("");
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {deleteCandidate ? (
        <DeleteAccountModal
          account={deleteCandidate}
          isPending={isPending}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={confirmDeleteAccount}
        />
      ) : null}
    </div>
  );
}

function DeleteAccountModal({
  account,
  isPending,
  onCancel,
  onConfirm,
}: {
  account: ChartAccount;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/45 px-md pt-[12vh] backdrop-blur-[1px]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        className="w-full max-w-[460px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
      >
        <div className="flex items-start gap-md border-b border-line bg-sunken px-lg py-lg">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <AlertTriangle size={18} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h2 id="delete-account-title" className="font-display text-title-3 text-ink">
              Excluir conta
            </h2>
            <p id="delete-account-description" className="mt-xs text-body-sm text-ink-secondary">
              Confirme a exclusão de{" "}
              <strong className="font-medium text-ink">"{account.name}"</strong> do plano de contas.
            </p>
          </div>
        </div>
        <div className="px-lg py-md text-body-sm text-ink-secondary">
          Se houver lançamentos vinculados, a exclusão será bloqueada automaticamente.
        </div>
        <div className="flex justify-end gap-sm border-t border-line bg-base px-lg py-md">
          <Button
            type="button"
            variant="ghost"
            className="border border-line"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            <Trash2 size={14} strokeWidth={1.7} />
            {isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TreeRows({
  node,
  expanded,
  editingId,
  drafts,
  newChildParentId,
  newChildName,
  isPending,
  onToggle,
  onEdit,
  onDraft,
  onSave,
  onCancelEdit,
  onToggleActive,
  onPrepareChild,
  onNewChildName,
  onAddChild,
  onDelete,
  onCancelChild,
}: {
  node: ChartAccountNode;
  expanded: Set<string>;
  editingId: string | null;
  drafts: Record<string, EditableFields>;
  newChildParentId: string | null;
  newChildName: string;
  isPending: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDraft: (id: string, patch: Partial<EditableFields>) => void;
  onSave: (id: string) => void;
  onCancelEdit: () => void;
  onToggleActive: (account: ChartAccount) => void;
  onPrepareChild: (parentId: string) => void;
  onNewChildName: (value: string) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (account: ChartAccount) => void;
  onCancelChild: () => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isEditing = editingId === node.id;
  const isRoot = node.parent_id === null;
  const draft = drafts[node.id] ?? toEditableFields(node);
  const groupNumber = getGroupNumber(node.code);

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[38px_40px_76px_minmax(260px,1fr)_104px_132px_76px_160px] items-center border-b text-body-sm transition-colors",
          isRoot
            ? "border-line bg-sunken hover:bg-[#ECEAE5]"
            : "border-[#F0EEE9] bg-surface hover:bg-base",
          !draft.is_active && "opacity-45",
          isEditing && "bg-[#FBF7F4] outline-2 outline-orange outline-offset-[-2px]",
        )}
      >
        <div className="flex justify-center text-line-strong">
          {!isRoot ? <GripVertical size={13} strokeWidth={1.5} /> : null}
        </div>
        <button
          type="button"
          className="flex h-full items-center justify-center text-ink-secondary"
          onClick={() => hasChildren && onToggle(node.id)}
          aria-label={isExpanded ? "Recolher grupo" : "Expandir grupo"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown size={15} strokeWidth={2} />
            ) : (
              <ChevronRight size={15} strokeWidth={2} />
            )
          ) : null}
        </button>
        <div
          className={cn(
            "px-sm font-mono text-meta text-ink-tertiary",
            isRoot && "font-semibold text-ink",
          )}
        >
          {node.code}
        </div>
        <div
          className="flex min-w-0 items-center gap-sm py-[10px] pr-sm"
          style={{ paddingLeft: isRoot ? 8 : 8 + node.depth * 18 }}
        >
          {isRoot && groupNumber ? (
            <span
              className={cn(
                "size-[10px] shrink-0 rounded-full",
                GROUP_SWATCH[groupNumber] ?? "bg-ink-tertiary",
              )}
            />
          ) : null}
          {isEditing ? (
            <Input
              value={draft.name}
              onChange={(event) => onDraft(node.id, { name: event.target.value })}
              className="h-8 py-xs text-body-sm"
              autoFocus
            />
          ) : (
            <span
              className={cn(
                "truncate",
                isRoot ? "font-semibold uppercase text-ink" : "text-ink",
                !draft.is_active && "text-ink-tertiary line-through",
              )}
            >
              {node.name}
              {hasChildren ? (
                <span className="ml-sm font-normal normal-case text-ink-tertiary">
                  ({flattenChartAccountTree(node.children).length} contas)
                </span>
              ) : null}
            </span>
          )}
        </div>
        <div>
          {isEditing ? (
            <select
              value={draft.nature}
              onChange={(event) =>
                onDraft(node.id, { nature: event.target.value as ChartAccountNature })
              }
              className="rounded-md border border-orange bg-surface px-xs py-xs text-meta text-ink outline-none"
            >
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
              <option value="transfer">Transfer.</option>
              <option value="calculated">Calculado</option>
            </select>
          ) : (
            <TypeBadge nature={draft.nature} />
          )}
        </div>
        <div>
          {isEditing ? (
            <select
              value={draft.cost_classification ?? ""}
              onChange={(event) =>
                onDraft(node.id, {
                  cost_classification: normalizeCostClassification(event.target.value),
                })
              }
              className="rounded-md border border-orange bg-surface px-xs py-xs text-meta text-ink outline-none"
            >
              <option value="">—</option>
              <option value="fixed">Fixo</option>
              <option value="variable">Variável</option>
            </select>
          ) : (
            <ClassificationBadge value={draft.cost_classification} />
          )}
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            className={cn(
              "relative h-[18px] w-[32px] rounded-full transition-colors",
              draft.is_active ? "bg-green" : "bg-line-strong",
            )}
            onClick={() => onToggleActive(node)}
            disabled={isPending}
            aria-label={draft.is_active ? "Desativar conta" : "Ativar conta"}
          >
            <span
              className={cn(
                "absolute top-[3px] size-[12px] rounded-full bg-surface shadow-sm transition-all",
                draft.is_active ? "left-[17px]" : "left-[3px]",
              )}
            />
          </button>
        </div>
        <div className="flex justify-end gap-xs pr-md">
          {isEditing ? (
            <>
              <IconButton label="Salvar" disabled={isPending} onClick={() => onSave(node.id)}>
                <Check size={13} strokeWidth={2} className="text-success" />
              </IconButton>
              <IconButton label="Cancelar" onClick={onCancelEdit}>
                <X size={13} strokeWidth={2} />
              </IconButton>
              <IconButton label="Excluir" disabled={isPending} onClick={() => onDelete(node)}>
                <Trash2 size={13} strokeWidth={1.5} />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton label="Editar" onClick={() => onEdit(node.id)}>
                <CheckAwarePencil />
              </IconButton>
              <IconButton label="Adicionar subconta" onClick={() => onPrepareChild(node.id)}>
                <Plus size={13} strokeWidth={1.5} />
              </IconButton>
              <IconButton label="Excluir" disabled={isPending} onClick={() => onDelete(node)}>
                <Trash2 size={13} strokeWidth={1.5} className="text-danger" />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {newChildParentId === node.id ? (
        <div className="grid grid-cols-[154px_minmax(260px,1fr)_236px] items-center gap-sm border-b border-[#F0EEE9] bg-base px-md py-sm">
          <div />
          <Input
            value={newChildName}
            onChange={(event) => onNewChildName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAddChild(node.id);
              }
              if (event.key === "Escape") {
                onCancelChild();
              }
            }}
            placeholder="Nome da nova conta... (Enter para salvar)"
            className="border-dashed bg-surface text-body-sm"
            autoFocus
          />
          <div className="flex gap-sm">
            <Button
              type="button"
              size="sm"
              onClick={() => onAddChild(node.id)}
              disabled={isPending}
            >
              Salvar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="border border-line"
              onClick={onCancelChild}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      {hasChildren && isExpanded
        ? node.children.map((child) => (
            <TreeRows
              key={child.id}
              node={child}
              expanded={expanded}
              editingId={editingId}
              drafts={drafts}
              newChildParentId={newChildParentId}
              newChildName={newChildName}
              isPending={isPending}
              onToggle={onToggle}
              onEdit={onEdit}
              onDraft={onDraft}
              onSave={onSave}
              onCancelEdit={onCancelEdit}
              onToggleActive={onToggleActive}
              onPrepareChild={onPrepareChild}
              onNewChildName={onNewChildName}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onCancelChild={onCancelChild}
            />
          ))
        : null}
    </>
  );
}

function HeaderCell({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "px-sm py-[10px] text-label font-medium uppercase text-ink-tertiary",
        className,
      )}
    >
      {children}
    </div>
  );
}

function TypeBadge({ nature }: { nature: ChartAccountNature }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-sm py-xs text-[10px] font-medium uppercase tracking-[0.06em]",
        NATURE_STYLE[nature],
      )}
    >
      {NATURE_LABEL[nature]}
    </span>
  );
}

function ClassificationBadge({ value }: { value: CostClassification | null }) {
  if (!value) {
    return <span className="text-meta text-ink-tertiary">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-sm px-sm py-xs text-[10px] font-medium uppercase tracking-[0.06em]",
        value === "fixed" ? "bg-warning-soft text-warning" : "bg-[#F0EEE9] text-ink-secondary",
      )}
    >
      {CLASSIFICATION_LABEL[value]}
    </span>
  );
}

function IconButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-ink-tertiary transition-colors hover:bg-sunken hover:text-ink-secondary disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function CheckAwarePencil() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[13px]"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-xs text-meta text-ink-tertiary">
      <span className={cn("size-[10px] rounded-[2px]", color)} />
      {label}
    </span>
  );
}

function toEditableFields(account: ChartAccount): EditableFields {
  return {
    name: account.name,
    nature: normalizeNature(account.nature),
    cost_classification: normalizeCostClassification(account.cost_classification),
    is_active: account.is_active,
  };
}

function normalizeNature(value: string): ChartAccountNature {
  if (value === "income" || value === "expense" || value === "transfer" || value === "calculated") {
    return value;
  }

  return "expense";
}

function normalizeCostClassification(value: string | null): CostClassification | null {
  if (value === "fixed" || value === "variable") {
    return value;
  }

  return null;
}

function filterTree(nodes: ChartAccountNode[], query: string): ChartAccountNode[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterTree(node.children, normalizedQuery);
    const matches =
      node.name.toLowerCase().includes(normalizedQuery) ||
      node.code.toLowerCase().includes(normalizedQuery);

    if (!matches && children.length === 0) {
      return [];
    }

    return [{ ...node, children }];
  });
}

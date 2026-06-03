import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  Briefcase,
  Truck,
  Stethoscope,
  Package,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

export type GlobalSearchHit = {
  id: string;
  label: string;
  contact?: string;
  email?: string;
  sublabel?: string;
  href: string;
};

export type GlobalSearchGroup = {
  category: string;
  icon: LucideIcon;
  items: GlobalSearchHit[];
};

type PatientRow = {
  id: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  contact?: string;
  email?: string;
};
type SupplierRow = {
  id: string;
  name?: string;
  contact?: string;
  email?: string;
};
type ProcedureRow = { id: string; name?: string; remarks?: string };
type ProductRow = { id: string; name?: string };
type EmployeeRow = {
  id: string;
  first_name?: string;
  last_name?: string;
  contact?: string;
  email?: string;
};

type SearchResponse = {
  patients: PatientRow[];
  suppliers: SupplierRow[];
  procedures: ProcedureRow[];
  products: ProductRow[];
  employees: EmployeeRow[];
};

const searchCategoryScopes: Record<string, string> = {
  Patients: "patients:read",
  Employees: "employees:read",
  Suppliers: "suppliers:read",
  Procedures: "procedures:read",
  Products: "products:read",
};

function joinName(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").trim();
}

async function fetchResults(query: string): Promise<GlobalSearchGroup[]> {
  const data = await api.get<SearchResponse>(
    `/search?q=${encodeURIComponent(query)}`,
    { silent: true },
  );

  return [
    {
      category: "Patients",
      icon: Users,
      items: (data.patients ?? []).map((p) => ({
        id: p.id,
        label: joinName(p.first_name, p.middle_name, p.last_name) || "---",
        contact: p.contact,
        email: p.email,
        href: `/patients/${p.id}`,
      })),
    },
    {
      category: "Employees",
      icon: Briefcase,
      items: (data.employees ?? []).map((e) => ({
        id: e.id,
        label: joinName(e.first_name, e.last_name) || "---",
        contact: e.contact,
        email: e.email,
        href: `/team/${e.id}`,
      })),
    },
    {
      category: "Suppliers",
      icon: Truck,
      items: (data.suppliers ?? []).map((s) => ({
        id: s.id,
        label: s.name ?? "---",
        contact: s.contact,
        email: s.email,
        href: `/suppliers/${s.id}`,
      })),
    },
    {
      category: "Procedures",
      icon: Stethoscope,
      items: (data.procedures ?? []).map((pr) => ({
        id: pr.id,
        label: pr.name ?? "---",
        sublabel: pr.remarks,
        href: `/services/procedures/${pr.id}`,
      })),
    },
    {
      category: "Products",
      icon: Package,
      items: (data.products ?? []).map((pd) => ({
        id: pd.id,
        label: pd.name ?? "---",
        href: `/inventory/products/${pd.id}`,
      })),
    },
  ];
}

export function HeaderSearch() {
  const navigate = useNavigate();
  const { scopes } = usePermissions();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchResults(query)
        .then((results) => {
          if (cancelled) return;
          setGroups(
            results.filter((group) =>
              scopes.includes(searchCategoryScopes[group.category] ?? ""),
            ),
          );
        })
        .catch(() => {
          if (!cancelled) setGroups([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, scopes]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (hit: GlobalSearchHit) => {
    setOpen(false);
    setMobileOpen(false);
    setQuery("");
    navigate(hit.href);
  };

  const showDropdown = open && query.trim().length > 0;
  const hasResults = groups.some((g) => g.items.length > 0);

  const results = !hasResults ? (
    <p className="p-6 text-center text-sm text-muted-foreground">No results</p>
  ) : (
    <div className="max-h-112 overflow-auto">
      {groups
        .filter((g) => g.items.length > 0)
        .map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.category}>
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                <Icon className="size-3.5" />
                {group.category}
              </div>
              {group.items.map((hit) => {
                const contactLine =
                  hit.contact && hit.email
                    ? `${hit.contact} - ${hit.email}`
                    : hit.contact || hit.email || hit.sublabel;
                return (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => handleSelect(hit)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="font-medium">{hit.label}</span>
                    {contactLine && (
                      <span className="truncate text-xs text-muted-foreground">
                        {contactLine}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
    </div>
  );

  return (
    <>
      <div ref={containerRef} className="relative hidden sm:block">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="h-8 w-48 pl-8 bg-secondary lg:w-64"
        />

        {showDropdown && (
          <div className="absolute left-1/2 top-full z-50 mt-2 w-md -translate-x-1/2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg lg:w-lg">
            {results}
          </div>
        )}
      </div>

      <Popover
        open={mobileOpen}
        onOpenChange={(next) => {
          setMobileOpen(next);
          setOpen(next);
        }}
      >
        <PopoverTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8 sm:hidden">
              <Search className="size-4" />
              <span className="sr-only">Search</span>
            </Button>
          }
        />
        <PopoverContent
          align="end"
          className="w-[calc(100vw-2rem)] overflow-hidden p-0 sm:hidden"
        >
          <div className="relative border-b p-3">
            <Search className="absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              type="search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              className="h-9 pl-8 bg-secondary"
            />
          </div>
          {query.trim().length > 0 && results}
        </PopoverContent>
      </Popover>
    </>
  );
}

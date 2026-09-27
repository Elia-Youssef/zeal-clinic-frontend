import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DropdownOption = {
  value: string;
  label: string;
  meta?: Record<string, unknown>;
};

/** A row of a `/dropdown` endpoint. */
export type DropdownItem = { id: string; name: string };

export function SearchableDropdown({
  id,
  value,
  onChange,
  options: staticOptions,
  defaultApiOption,
  apiEndpoint,
  apiOptionsLimit = 7,
  mapItem,
  placeholder = "Select",
  required,
  className,
  disabled,
  clearable = false,
  defaultFirst = false,
  onSelectItem,
  renderAddForm,
}: {
  /** The trigger's id, for a <label htmlFor>; the label names it, the shown value describes it. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options?: DropdownOption[];
  defaultApiOption?: DropdownOption;
  apiEndpoint?: string;
  apiOptionsLimit?: number;
  mapItem?: (item: DropdownItem) => DropdownOption;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  defaultFirst?: boolean;
  onSelectItem?: (option: DropdownOption) => void;
  renderAddForm?: (props: {
    open: boolean;
    onClose: () => void;
    onCreated: (value: string, label: string) => void;
  }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [apiOptions, setApiOptions] = useState<DropdownOption[]>([]);
  const [selectedCache, setSelectedCache] = useState<DropdownOption | null>(
    null,
  );

  const [addFormOpen, setAddFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // The latest mapItem, outside the effect's dependencies: callers pass an
  // inline arrow, and a fetch on every render would never settle.
  const mapItemRef = useRef(mapItem);
  useEffect(() => {
    mapItemRef.current = mapItem;
  });
  const hasMapItem = mapItem !== undefined;

  useEffect(() => {
    if (!apiEndpoint || !hasMapItem) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: `${apiOptionsLimit}` });
      if (search) params.set("filter", search);
      api
        .get<unknown>(
          `${apiEndpoint}${apiEndpoint.includes("?") ? "&" : "?"}${params}`,
          { silent: true },
        )
        .then((res) => {
          const map = mapItemRef.current;
          const items: DropdownItem[] = Array.isArray(res) ? res : [];
          setApiOptions(map ? items.map(map) : []);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [apiEndpoint, hasMapItem, apiOptionsLimit, search, refreshKey]);

  // The option chosen before (its label comes from the caller) stays listed
  // even when the last search didn't return it.
  const apiOptionsWithDefault = useMemo(
    () =>
      defaultApiOption &&
      !apiOptions.some((i) => i.value == defaultApiOption.value)
        ? [defaultApiOption, ...apiOptions]
        : apiOptions,
    [defaultApiOption, apiOptions],
  );

  const allOptions = staticOptions ?? apiOptionsWithDefault;

  const didAutoSelectRef = useRef(false);
  useEffect(() => {
    if (defaultFirst && !value) didAutoSelectRef.current = false;
  }, [defaultFirst, value]);

  useEffect(() => {
    if (!defaultFirst || didAutoSelectRef.current) return;
    if (value) {
      didAutoSelectRef.current = true;
      return;
    }
    const first = allOptions[0];
    if (!first) return;
    didAutoSelectRef.current = true;
    // `first` is one of allOptions, so its label needs no cache entry.
    onSelectItem?.(first);
    onChange(first.value);
  }, [defaultFirst, allOptions, value, onChange, onSelectItem]);

  const filtered = useMemo(() => {
    if (apiEndpoint || !search) return allOptions;
    const lower = search.toLowerCase();
    return allOptions.filter((o) => o.label.toLowerCase().includes(lower));
  }, [allOptions, search, apiEndpoint]);

  const selectedLabel =
    allOptions.find((o) => o.value === value)?.label ??
    (selectedCache?.value === value ? selectedCache.label : "");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  };

  const select = (v: string) => {
    const opt = allOptions.find((o) => o.value === v);
    if (opt) {
      setSelectedCache(opt);
      onSelectItem?.(opt);
    }
    onChange(v);
    handleOpenChange(false);
  };

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      {required && (
        <input
          tabIndex={-1}
          className="absolute inset-0 opacity-0 pointer-events-none"
          value={value}
          onChange={() => {}}
          required
        />
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          id={id}
          aria-describedby={id ? `${id}-value` : undefined}
          disabled={disabled}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:text-sm dark:bg-input/30",
            !value && "text-muted-foreground",
          )}
        >
          <span id={id ? `${id}-value` : undefined} className="truncate">
            {selectedLabel || placeholder}
          </span>
          {clearable && value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCache(null);
                setSearch("");
                onChange("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedCache(null);
                  setSearch("");
                  onChange("");
                }
              }}
              className="ml-1 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="size-3.5" />
            </span>
          ) : (
            <ChevronDown className="ml-1 size-3.5 shrink-0 opacity-50" />
          )}
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="w-auto min-w-(--anchor-width) max-w-[min(28rem,calc(100vw-1rem))] max-h-56 gap-0 overflow-hidden p-0"
          initialFocus={false}
        >
          <div className="flex items-center gap-1 p-1.5">
            <input
              type="text"
              className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Search"
              aria-label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {renderAddForm && (
              <button
                type="button"
                title="Add new"
                onClick={() => {
                  handleOpenChange(false);
                  setAddFormOpen(true);
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
          <div className="max-h-44 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No results.
              </p>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => select(opt.value)}
                  className={cn(
                    "block w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    opt.value === value && "bg-accent font-medium",
                  )}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {renderAddForm?.({
        open: addFormOpen,
        onClose: () => setAddFormOpen(false),
        onCreated: (newValue, newLabel) => {
          setSelectedCache({ value: newValue, label: newLabel });
          onChange(newValue);
          setAddFormOpen(false);
          handleOpenChange(false);
          setRefreshKey((k) => k + 1);
        },
      })}
    </div>
  );
}

"use client";

import type { TodoState } from "@/lib/conversation-state";
import type { TodoPublic } from "@/lib/client";
import { cn } from "@/lib/utils";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuiState } from "@assistant-ui/react";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  CircleIcon,
  LoaderCircleIcon,
} from "lucide-react";

const statusIcon = {
  completed: CheckCircle2Icon,
  in_progress: LoaderCircleIcon,
  pending: CircleIcon,
};

export function TodoList() {
  const todoState = useAuiState(
    (state) => state.thread.state,
  ) as TodoState | null;
  const todos = todoState?.todos ?? [];

  return (
    <Collapsible defaultOpen>
      <CardHeader>
        <CollapsibleTrigger className="group flex w-full items-center justify-between">
          <CardTitle className="font-normal">待办</CardTitle>
          <ChevronDownIcon className="size-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0" />
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
        <CardContent className="max-h-64 overflow-y-auto pt-2">
          {todos.length === 0 ? (
            <CardDescription className="text-sm">暂无待办</CardDescription>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {todos.map((todo, index) => (
                <TodoItem key={`${todo.content}-${index}`} todo={todo} />
              ))}
            </ul>
          )}
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}

function TodoItem({ todo }: { todo: TodoPublic }) {
  const Icon = statusIcon[todo.status];

  return (
    <li className="flex items-start gap-2">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          todo.status === "in_progress" && "animate-spin",
        )}
      />
      <span
        className={todo.status === "completed" ? "line-through" : undefined}
      >
        {todo.content}
      </span>
    </li>
  );
}

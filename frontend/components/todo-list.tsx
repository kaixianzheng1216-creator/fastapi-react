"use client";

import { type Todo, type TodoState } from "@/app/MyRuntimeProvider";
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
          <CardTitle className="font-normal">代办</CardTitle>
          <ChevronDownIcon className="size-4 -rotate-90 transition-transform group-data-[state=open]:rotate-0" />
        </CollapsibleTrigger>
      </CardHeader>
      <CollapsibleContent>
        <CardContent>
          {todos.length === 0 ? (
            <CardDescription className="text-base">暂无代办</CardDescription>
          ) : (
            <ul className="space-y-3">
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

function TodoItem({ todo }: { todo: Todo }) {
  const Icon = statusIcon[todo.status];

  return (
    <li className="flex items-start gap-2">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${
          todo.status === "in_progress" ? "animate-spin" : ""
        }`}
      />
      <span
        className={todo.status === "completed" ? "line-through" : undefined}
      >
        {todo.content}
      </span>
    </li>
  );
}

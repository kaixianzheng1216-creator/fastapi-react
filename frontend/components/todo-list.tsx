"use client";

import { type Todo, type TodoState } from "@/app/MyRuntimeProvider";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuiState } from "@assistant-ui/react";
import { CheckCircle2Icon, CircleIcon, LoaderCircleIcon } from "lucide-react";

const statusIcon = {
  completed: CheckCircle2Icon,
  in_progress: LoaderCircleIcon,
  pending: CircleIcon,
};

export function TodoList() {
  const hasMessages = useAuiState((state) => state.thread.messages.length > 0);
  const todoState = useAuiState((state) => state.thread.state) as
    | TodoState
    | null;
  const todos = todoState?.todos ?? [];

  if (!hasMessages) return null;

  return (
    <aside className="hidden w-80 justify-self-end p-4 2xl:block">
      <Card className="gap-2 py-4">
        <CardHeader>
          <CardTitle className="text-muted-foreground font-normal">
            任务清单
          </CardTitle>
        </CardHeader>
        {todos.length > 0 && (
          <CardContent>
            <ul className="space-y-3">
              {todos.map((todo, index) => (
                <TodoItem key={`${todo.content}-${index}`} todo={todo} />
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </aside>
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

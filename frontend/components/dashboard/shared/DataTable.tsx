"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface DataTableProps<T> {
  title: string;
  description?: string;
  data: T[];
  columns: {
    key: keyof T | string;
    label: string;
    render?: (item: T) => React.ReactNode;
  }[];
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>({
  title,
  description,
  data,
  columns,
  emptyMessage = "No data available",
}: DataTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-3">
            {data.map((item, index) => (
              <div
                key={index}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="grid gap-2">
                  {columns.map((column) => (
                    <div
                      key={String(column.key)}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-medium text-muted-foreground">
                        {column.label}:
                      </span>
                      <span className="text-sm">
                        {column.render
                          ? column.render(item)
                          : item[column.key as keyof T]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

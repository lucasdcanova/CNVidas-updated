import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChartData = {
  name: string;
  value?: number;
  [key: string]: any;
};

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  data: ChartData[];
  type?: 'line' | 'bar' | 'pie';
  categories?: string[];
  colors?: string[];
  xAxisKey?: string;
  height?: number;
}

const DEFAULT_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#a855f7', // purple-500
];

export function Chart({
  title,
  data,
  type = 'line',
  categories = ['value'],
  colors = DEFAULT_COLORS,
  xAxisKey = 'name',
  height = 300,
  className,
  ...props
}: ChartProps) {
  const [chartData, setChartData] = useState<ChartData[]>([]);

  useEffect(() => {
    setChartData(data);
  }, [data]);

  // Ensure there's enough colors for all categories
  const getColors = () => {
    if (colors.length >= categories.length) return colors;
    // Duplicate the color array until we have enough colors
    return Array(Math.ceil(categories.length / colors.length))
      .fill(colors)
      .flat()
      .slice(0, categories.length);
  };

  const chartColors = getColors();

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {categories.map((category, index) => (
                <Line
                  key={category}
                  type="monotone"
                  dataKey={category}
                  stroke={chartColors[index % chartColors.length]}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey={xAxisKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {categories.map((category, index) => (
                <Bar
                  key={category}
                  dataKey={category}
                  fill={chartColors[index % chartColors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey={xAxisKey}
                cx="50%"
                cy="50%"
                outerRadius={height / 3}
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)} {...props}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">{renderChart()}</CardContent>
    </Card>
  );
}
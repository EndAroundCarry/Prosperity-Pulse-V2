/**
 * Tree-shaken ECharts core.
 *
 * A naive `import * as echarts` adds ~1MB to the bundle. This module
 * registers only the charts/components the app uses, and is lazy-loaded
 * via `provideEchartsCore({ echarts: () => import('./echarts-core') })`.
 */
import * as echarts from 'echarts/core';
import { LineChart, CandlestickChart, BarChart, TreemapChart, GaugeChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components';

echarts.use([
  LineChart,
  CandlestickChart,
  BarChart,
  TreemapChart,
  GaugeChart,
  CanvasRenderer,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
]);

export { echarts };

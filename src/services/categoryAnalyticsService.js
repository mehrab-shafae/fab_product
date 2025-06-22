import { Category, Product, CategoryAttribute, ProductAttributeValue } from '../models/index.js';
import { Op, fn, col, literal } from 'sequelize';

export const categoryAnalyticsService = {
      // Get comprehensive category analytics
      async getCategoryAnalytics(categoryId, options = {}) {
            const {
                  includeSubcategories = true,
                  includeProducts = true,
                  includeAttributes = true,
                  dateRange = '30d', // 7d, 30d, 90d, 1y, all
                  groupBy = 'day', // day, week, month, year
            } = options;

            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            const dateFilter = this._buildDateFilter(dateRange);
            const categoryIds = includeSubcategories ? await this._getCategoryAndDescendants(categoryId) : [categoryId];

            const analytics = {
                  category: {
                        id: category.id,
                        name: category.name,
                        slug: category.slug,
                        level: category.level,
                        path: category.path,
                  },
                  overview: await this._getCategoryOverview(categoryIds, dateFilter),
                  trends: await this._getCategoryTrends(categoryIds, dateFilter, groupBy),
                  products: includeProducts ? await this._getProductAnalytics(categoryIds, dateFilter) : null,
                  attributes: includeAttributes ? await this._getAttributeAnalytics(categoryIds) : null,
                  performance: await this._getPerformanceMetrics(categoryIds, dateFilter),
                  comparisons: await this._getCategoryComparisons(categoryId, dateFilter),
            };

            return analytics;
      },

      // Get category performance metrics
      async getCategoryPerformance(categoryId, options = {}) {
            const { dateRange = '30d', metrics = ['views', 'sales', 'revenue'] } = options;
            const dateFilter = this._buildDateFilter(dateRange);
            const categoryIds = await this._getCategoryAndDescendants(categoryId);

            const performance = {};

            if (metrics.includes('views')) {
                  performance.views = await this._getViewMetrics(categoryIds, dateFilter);
            }

            if (metrics.includes('sales')) {
                  performance.sales = await this._getSalesMetrics(categoryIds, dateFilter);
            }

            if (metrics.includes('revenue')) {
                  performance.revenue = await this._getRevenueMetrics(categoryIds, dateFilter);
            }

            if (metrics.includes('conversion')) {
                  performance.conversion = await this._getConversionMetrics(categoryIds, dateFilter);
            }

            return performance;
      },

      // Get category hierarchy analytics
      async getHierarchyAnalytics(rootCategoryId = null) {
            const where = rootCategoryId ? { id: rootCategoryId } : { parent_id: null };

            const categories = await Category.findAll({
                  where,
                  include: [
                        {
                              model: Category,
                              as: 'children',
                              include: [
                                    {
                                          model: Category,
                                          as: 'children',
                                    },
                              ],
                        },
                  ],
                  order: [
                        ['order', 'ASC'],
                        ['name', 'ASC'],
                  ],
            });

            const hierarchyAnalytics = await Promise.all(
                  categories.map(async category => {
                        const descendants = await this._getCategoryAndDescendants(category.id);

                        return {
                              category: {
                                    id: category.id,
                                    name: category.name,
                                    slug: category.slug,
                                    level: category.level,
                              },
                              metrics: await this._getHierarchyMetrics(descendants),
                              children: await this._getChildrenAnalytics(category.children),
                        };
                  })
            );

            return hierarchyAnalytics;
      },

      // Get category growth analysis
      async getGrowthAnalysis(categoryId, options = {}) {
            const { periods = ['7d', '30d', '90d', '1y'], metrics = ['products', 'views', 'sales'] } = options;

            const growthData = {};

            for (const period of periods) {
                  const dateFilter = this._buildDateFilter(period);
                  const categoryIds = await this._getCategoryAndDescendants(categoryId);

                  growthData[period] = {};

                  for (const metric of metrics) {
                        growthData[period][metric] = await this._getGrowthMetric(categoryIds, dateFilter, metric);
                  }
            }

            return growthData;
      },

      // Get category comparison report
      async getComparisonReport(categoryIds, options = {}) {
            const { dateRange = '30d', metrics = ['products', 'views', 'sales', 'revenue'] } = options;
            const dateFilter = this._buildDateFilter(dateRange);

            const comparison = await Promise.all(
                  categoryIds.map(async categoryId => {
                        const category = await Category.findByPk(categoryId);
                        const descendants = await this._getCategoryAndDescendants(categoryId);

                        const categoryMetrics = {};

                        for (const metric of metrics) {
                              categoryMetrics[metric] = await this._getComparisonMetric(descendants, dateFilter, metric);
                        }

                        return {
                              category: {
                                    id: category.id,
                                    name: category.name,
                                    slug: category.slug,
                              },
                              metrics: categoryMetrics,
                        };
                  })
            );

            return comparison;
      },

      // Get category insights and recommendations
      async getCategoryInsights(categoryId) {
            const category = await Category.findByPk(categoryId);
            if (!category) {
                  throw new Error('Category not found');
            }

            const descendants = await this._getCategoryAndDescendants(category.id);
            const insights = {
                  category: {
                        id: category.id,
                        name: category.name,
                        slug: category.slug,
                  },
                  performance: await this._getPerformanceInsights(descendants),
                  opportunities: await this._getOpportunityInsights(descendants),
                  recommendations: await this._getRecommendations(descendants),
                  risks: await this._getRiskInsights(descendants),
            };

            return insights;
      },

      // Private helper methods
      async _getCategoryAndDescendants(categoryId) {
            const descendants = [categoryId];
            const queue = [categoryId];

            while (queue.length > 0) {
                  const currentId = queue.shift();
                  const children = await Category.findAll({
                        where: { parent_id: currentId },
                  });

                  for (const child of children) {
                        descendants.push(child.id);
                        queue.push(child.id);
                  }
            }

            return descendants;
      },

      _buildDateFilter(dateRange) {
            const now = new Date();
            let startDate;

            switch (dateRange) {
                  case '7d':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                  case '30d':
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                  case '90d':
                        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                  case '1y':
                        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        break;
                  case 'all':
                  default:
                        startDate = null;
            }

            return startDate
                  ? {
                          [Op.gte]: startDate,
                    }
                  : {};
      },

      async _getCategoryOverview(categoryIds, dateFilter) {
            const productCount = await Product.count({
                  where: {
                        category_id: { [Op.in]: categoryIds },
                        ...dateFilter,
                  },
            });

            const subcategoryCount = await Category.count({
                  where: {
                        parent_id: { [Op.in]: categoryIds },
                  },
            });

            const attributeCount = await CategoryAttribute.count({
                  where: {
                        category_id: { [Op.in]: categoryIds },
                  },
            });

            return {
                  totalProducts: productCount,
                  totalSubcategories: subcategoryCount,
                  totalAttributes: attributeCount,
                  averageProductsPerCategory: categoryIds.length > 0 ? productCount / categoryIds.length : 0,
            };
      },

      async _getCategoryTrends(categoryIds, dateFilter, groupBy) {
            // This would typically query a separate analytics/events table
            // For now, we'll return mock data structure
            return {
                  productGrowth: [],
                  viewGrowth: [],
                  salesGrowth: [],
                  revenueGrowth: [],
            };
      },

      async _getProductAnalytics(categoryIds, dateFilter) {
            const products = await Product.findAll({
                  where: {
                        category_id: { [Op.in]: categoryIds },
                        ...dateFilter,
                  },
                  attributes: ['id', 'name', 'price', 'status', [fn('COUNT', col('id')), 'total_count'], [fn('AVG', col('price')), 'avg_price'], [fn('MIN', col('price')), 'min_price'], [fn('MAX', col('price')), 'max_price']],
                  group: ['status'],
            });

            const priceDistribution = await Product.findAll({
                  where: {
                        category_id: { [Op.in]: categoryIds },
                        ...dateFilter,
                  },
                  attributes: [
                        [literal("CASE WHEN price < 100 THEN '0-100' WHEN price < 500 THEN '100-500' WHEN price < 1000 THEN '500-1000' ELSE '1000+' END"), 'price_range'],
                        [fn('COUNT', col('id')), 'count'],
                  ],
                  group: ['price_range'],
            });

            return {
                  totalProducts: products.reduce((sum, p) => sum + parseInt(p.dataValues.total_count), 0),
                  byStatus: products.map(p => ({
                        status: p.status,
                        count: parseInt(p.dataValues.total_count),
                  })),
                  priceStats: {
                        average: parseFloat(products[0]?.dataValues.avg_price || 0),
                        min: parseFloat(products[0]?.dataValues.min_price || 0),
                        max: parseFloat(products[0]?.dataValues.max_price || 0),
                  },
                  priceDistribution: priceDistribution.map(p => ({
                        range: p.dataValues.price_range,
                        count: parseInt(p.dataValues.count),
                  })),
            };
      },

      async _getAttributeAnalytics(categoryIds) {
            const attributes = await CategoryAttribute.findAll({
                  where: {
                        category_id: { [Op.in]: categoryIds },
                  },
                  include: [
                        {
                              model: CategoryAttributeOption,
                              as: 'options',
                        },
                  ],
                  attributes: ['id', 'name', 'type', 'required', [fn('COUNT', col('options.id')), 'option_count']],
                  group: ['CategoryAttribute.id', 'options.id'],
            });

            return {
                  totalAttributes: attributes.length,
                  byType: this._groupBy(attributes, 'type'),
                  requiredAttributes: attributes.filter(attr => attr.required).length,
                  attributeUsage: await this._getAttributeUsage(categoryIds),
            };
      },

      async _getPerformanceMetrics(categoryIds, dateFilter) {
            // Mock performance metrics - in real implementation, these would come from analytics tables
            return {
                  views: {
                        total: Math.floor(Math.random() * 10000),
                        average: Math.floor(Math.random() * 1000),
                        trend: Math.random() > 0.5 ? 'up' : 'down',
                  },
                  sales: {
                        total: Math.floor(Math.random() * 1000),
                        average: Math.floor(Math.random() * 100),
                        trend: Math.random() > 0.5 ? 'up' : 'down',
                  },
                  revenue: {
                        total: Math.floor(Math.random() * 100000),
                        average: Math.floor(Math.random() * 10000),
                        trend: Math.random() > 0.5 ? 'up' : 'down',
                  },
                  conversion: {
                        rate: Math.random() * 10,
                        trend: Math.random() > 0.5 ? 'up' : 'down',
                  },
            };
      },

      async _getCategoryComparisons(categoryId, dateFilter) {
            const category = await Category.findByPk(categoryId);
            const siblings = await Category.findAll({
                  where: {
                        parent_id: category.parent_id,
                        id: { [Op.ne]: categoryId },
                  },
            });

            const comparisons = await Promise.all(
                  siblings.map(async sibling => {
                        const siblingDescendants = await this._getCategoryAndDescendants(sibling.id);
                        const siblingMetrics = await this._getCategoryOverview(siblingDescendants, dateFilter);

                        return {
                              category: {
                                    id: sibling.id,
                                    name: sibling.name,
                                    slug: sibling.slug,
                              },
                              metrics: siblingMetrics,
                        };
                  })
            );

            return comparisons;
      },

      async _getHierarchyMetrics(categoryIds) {
            const productCount = await Product.count({
                  where: { category_id: { [Op.in]: categoryIds } },
            });

            const subcategoryCount = await Category.count({
                  where: { parent_id: { [Op.in]: categoryIds } },
            });

            return {
                  totalProducts: productCount,
                  totalSubcategories: subcategoryCount,
                  depth: Math.max(...categoryIds.map(id => this._getCategoryDepth(id))),
            };
      },

      async _getChildrenAnalytics(children) {
            if (!children || children.length === 0) return [];

            return await Promise.all(
                  children.map(async child => {
                        const descendants = await this._getCategoryAndDescendants(child.id);
                        return {
                              category: {
                                    id: child.id,
                                    name: child.name,
                                    slug: child.slug,
                              },
                              metrics: await this._getHierarchyMetrics(descendants),
                              children: await this._getChildrenAnalytics(child.children),
                        };
                  })
            );
      },

      async _getGrowthMetric(categoryIds, dateFilter, metric) {
            // Mock growth metrics - in real implementation, these would be calculated from historical data
            return {
                  current: Math.floor(Math.random() * 1000),
                  previous: Math.floor(Math.random() * 1000),
                  growth: Math.random() * 100 - 50, // -50% to +50%
                  trend: Math.random() > 0.5 ? 'up' : 'down',
            };
      },

      async _getComparisonMetric(categoryIds, dateFilter, metric) {
            // Mock comparison metrics
            return {
                  value: Math.floor(Math.random() * 1000),
                  rank: Math.floor(Math.random() * 10) + 1,
                  percentile: Math.random() * 100,
            };
      },

      async _getPerformanceInsights(descendants) {
            // Mock performance insights
            return {
                  strengths: ['High product variety', 'Good price range', 'Active subcategories'],
                  weaknesses: ['Low conversion rate', 'Limited attribute coverage'],
                  opportunities: ['Expand product range', 'Improve SEO optimization'],
            };
      },

      async _getOpportunityInsights(descendants) {
            // Mock opportunity insights
            return {
                  marketGaps: ['Premium product segment', 'Eco-friendly options'],
                  growthAreas: ['International markets', 'Digital products'],
                  optimization: ['Price optimization', 'Inventory management'],
            };
      },

      async _getRecommendations(descendants) {
            // Mock recommendations
            return {
                  immediate: ['Add more product attributes', 'Optimize category descriptions'],
                  shortTerm: ['Launch promotional campaigns', 'Improve product images'],
                  longTerm: ['Expand to new markets', 'Develop private label products'],
            };
      },

      async _getRiskInsights(descendants) {
            // Mock risk insights
            return {
                  high: ['Dependency on few suppliers', 'Seasonal demand fluctuations'],
                  medium: ['Competition from new entrants', 'Price sensitivity'],
                  low: ['Brand recognition', 'Customer loyalty'],
            };
      },

      async _getAttributeUsage(categoryIds) {
            // Mock attribute usage data
            return {
                  mostUsed: ['Color', 'Size', 'Brand'],
                  leastUsed: ['Material', 'Warranty', 'Origin'],
                  coverage: Math.random() * 100,
            };
      },

      _groupBy(array, key) {
            return array.reduce((groups, item) => {
                  const group = item[key];
                  groups[group] = groups[group] || [];
                  groups[group].push(item);
                  return groups;
            }, {});
      },

      _getCategoryDepth(categoryId) {
            // Mock depth calculation
            return Math.floor(Math.random() * 5) + 1;
      },

      // Mock methods for view, sales, revenue, and conversion metrics
      async _getViewMetrics(categoryIds, dateFilter) {
            return {
                  total: Math.floor(Math.random() * 10000),
                  unique: Math.floor(Math.random() * 5000),
                  average: Math.floor(Math.random() * 1000),
            };
      },

      async _getSalesMetrics(categoryIds, dateFilter) {
            return {
                  total: Math.floor(Math.random() * 1000),
                  average: Math.floor(Math.random() * 100),
                  topProducts: [],
            };
      },

      async _getRevenueMetrics(categoryIds, dateFilter) {
            return {
                  total: Math.floor(Math.random() * 100000),
                  average: Math.floor(Math.random() * 10000),
                  growth: Math.random() * 100 - 50,
            };
      },

      async _getConversionMetrics(categoryIds, dateFilter) {
            return {
                  rate: Math.random() * 10,
                  funnel: {
                        views: Math.floor(Math.random() * 10000),
                        cart: Math.floor(Math.random() * 1000),
                        purchase: Math.floor(Math.random() * 100),
                  },
            };
      },
};

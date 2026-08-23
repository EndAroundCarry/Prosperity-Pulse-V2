/**
 * pp-widget-card — reusable card wrapper for dashboard widgets.
 *
 * Provides title, freshness badge, info tooltip, and an error slot.
 * Every dashboard widget wraps in this for consistent layout.
 */

import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'pp-widget-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="widget-card">
      <div class="widget-header">
        <div class="widget-title-row">
          @if (icon) {
            <mat-icon class="widget-icon">{{ icon }}</mat-icon>
          }
          <h3 class="widget-title">{{ title }}</h3>
          @if (infoTooltip) {
            <mat-icon
              class="info-icon"
              [matTooltip]="infoTooltip"
              matTooltipPosition="above"
            >info_outline</mat-icon>
          }
        </div>
        @if (asOf) {
          <span class="freshness-badge" [class.stale]="stale">
            {{ asOf }}
          </span>
        }
      </div>

      @if (errorMessage) {
        <div class="widget-error">
          <mat-icon>warning</mat-icon>
          <span>{{ errorMessage }}</span>
        </div>
      } @else if (empty) {
        <div class="widget-empty">
          <mat-icon>hourglass_empty</mat-icon>
          <span>{{ emptyMessage || 'First fetch queued — check back shortly' }}</span>
        </div>
      } @else {
        <ng-content></ng-content>
      }
    </mat-card>
  `,
  styles: [`
    :host {
      display: block;
    }
    .widget-card {
      border-radius: 1rem;
      border: 1px solid rgba(0,0,0,0.06);
      overflow: hidden;
      height: 100%;
    }
    :host-context(.dark-mode) .widget-card {
      background: #1e293b;
      border-color: #334155;
    }
    .widget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 8px;
    }
    .widget-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .widget-icon {
      color: #3b82f6;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .widget-title {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin: 0;
    }
    :host-context(.dark-mode) .widget-title {
      color: #94a3b8;
    }
    .info-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #94a3b8;
      cursor: help;
    }
    .freshness-badge {
      font-size: 0.6875rem;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .freshness-badge.stale {
      color: #d97706;
      background: #fef3c7;
    }
    :host-context(.dark-mode) .freshness-badge {
      background: #334155;
      color: #94a3b8;
    }
    :host-context(.dark-mode) .freshness-badge.stale {
      color: #fbbf24;
      background: #78350f;
    }
    .widget-error,
    .widget-empty {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px 16px;
      font-size: 0.8125rem;
      color: #64748b;
    }
    .widget-error {
      color: #dc2626;
    }
    :host-context(.dark-mode) .widget-error {
      color: #f87171;
    }
    :host-context(.dark-mode) .widget-empty {
      color: #64748b;
    }
  `],
})
export class PpWidgetCardComponent {
  @Input() title = '';
  @Input() icon = '';
  @Input() asOf = '';
  @Input() stale = false;
  @Input() infoTooltip = '';
  @Input() errorMessage = '';
  @Input() empty = false;
  @Input() emptyMessage = '';
}

import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { SparklineComponent } from './sparkline.component';

@Component({
  standalone: true,
  imports: [SparklineComponent],
  template: `<pp-sparkline [points]="points" [width]="100" [height]="32" />`,
})
class HostComponent {
  points: number[] = [1, 2, 3];
}

describe('SparklineComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders an SVG polyline when there are 2+ points', () => {
    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg).toBeTruthy();
    const polyline = svg.querySelector('polyline') as SVGElement;
    expect(polyline).toBeTruthy();
    expect(polyline.getAttribute('points')).toContain(',');
  });

  it('renders nothing for < 2 points', () => {
    host.points = [5];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('normalizes the polyline into the viewBox height', () => {
    host.points = [0, 50];
    fixture.detectChanges();
    const polyline = fixture.nativeElement.querySelector('polyline') as SVGElement;
    const points = polyline.getAttribute('points')!.split(' ').map((p) => p.split(',')[1]);
    // First point at bottom (y=32), last at top (y=0).
    expect(Number(points[0])).toBeCloseTo(32, 1);
    expect(Number(points[1])).toBeCloseTo(0, 1);
  });
});

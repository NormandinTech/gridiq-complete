"""
GridIQ — Vegetation Engine Tests
"""
import asyncio, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_vegetation_tests():
    print()
    print('[VEG 1/5] LiDAR data structures...')
    from backend.vegetation.lidar_ingest import (
        GeoPoint, TransmissionSpan, USGS3DEPAdapter, LiDARDataManager
    )
    p = GeoPoint(lat=37.77, lon=-122.41, elevation_m=50)
    assert p.lat == 37.77 and p.elevation_m == 50
    span = TransmissionSpan(
        span_id='T001', line_id='L1', line_name='Test 115kV',
        start=GeoPoint(37.80, -122.40, 100),
        end=GeoPoint(37.78, -122.38, 120),
        conductor_height_m=10.5, voltage_kv=115,
        length_m=2800, right_of_way_width_m=15, zone='Test Zone',
    )
    assert span.span_id == 'T001' and span.voltage_kv == 115
    print('   ✓ GeoPoint + TransmissionSpan dataclasses')

    adapter = USGS3DEPAdapter()
    bbox = adapter._span_bbox(span, buffer_m=30)
    assert len(bbox) == 4
    w, s, e, n = bbox
    assert w < span.start.lon < e
    assert s < span.start.lat < n
    print(f'   ✓ Bounding box: ({w:.4f}, {s:.4f}, {e:.4f}, {n:.4f})')

    survey = adapter._simulate_survey(span)
    assert survey.span_id == 'T001'
    assert len(survey.canopy_points) > 0
    assert survey.total_returns > 0
    assert all(p.height_m >= 0 for p in survey.canopy_points)
    assert all(p.classification in ('tree','shrub','ground') for p in survey.canopy_points)
    print(f'   ✓ Simulated survey: {len(survey.canopy_points)} canopy points, {survey.total_returns} total returns')

    print()
    print('[VEG 2/5] NERC clearance requirements...')
    from backend.vegetation.risk_engine import nerc_clearance
    assert nerc_clearance(69)  == 3.05
    assert nerc_clearance(115) == 3.05
    assert nerc_clearance(230) == 3.05
    assert nerc_clearance(345) == 4.27
    assert nerc_clearance(500) == 6.10
    assert nerc_clearance(765) == 7.62
    print('   ✓ NERC FAC-003 clearances: 115kV=3.05m | 345kV=4.27m | 500kV=6.10m | 765kV=7.62m')

    print()
    print('[VEG 3/5] Risk scoring engine...')
    from backend.vegetation.risk_engine import VegetationRiskEngine, SPECIES_RISK
    engine = VegetationRiskEngine()

    score = engine.score_span(span, survey)
    assert 0 <= score.overall_risk_score <= 100
    assert score.risk_level in ('critical', 'high', 'medium', 'low')
    assert score.nerc_min_clearance_m == 3.05
    assert score.work_order_priority in ('immediate', '30_days', '90_days', 'annual')
    assert len(score.recommended_action) > 10
    assert score.total_trees_in_corridor == len(survey.canopy_points)
    print(f'   ✓ Score: {score.overall_risk_score} ({score.risk_level}) | priority: {score.work_order_priority}')
    print(f'   ✓ Violations: {score.clearance_violations} | encroaching: {score.encroaching_trees}')
    print(f'   ✓ Dominant species: {score.dominant_species} | growth: {score.growth_rate_m_yr}m/yr')

    # High-voltage line should need larger clearance
    hv_span = TransmissionSpan(
        span_id='T500', line_id='L2', line_name='500kV',
        start=GeoPoint(37.35, -121.0, 25), end=GeoPoint(37.30, -120.9, 28),
        conductor_height_m=18.0, voltage_kv=500, length_m=9000,
        right_of_way_width_m=30, zone='South',
    )
    hv_adapter = USGS3DEPAdapter()
    hv_survey = hv_adapter._simulate_survey(hv_span)
    hv_score = engine.score_span(hv_span, hv_survey)
    assert hv_score.nerc_min_clearance_m == 6.10
    print(f'   ✓ 500kV line: NERC min {hv_score.nerc_min_clearance_m}m correctly applied')

    # Species risk table sanity
    assert SPECIES_RISK['eucalyptus']['fire'] > SPECIES_RISK['live_oak']['fire']
    assert SPECIES_RISK['eucalyptus']['growth'] > SPECIES_RISK['live_oak']['growth']
    print('   ✓ Species risk: eucalyptus > live_oak for fire and growth')

    # Terrain multiplier
    flat_span = TransmissionSpan('T_flat','L','flat',GeoPoint(37.0,-122.0,50),GeoPoint(37.1,-122.1,52),10,115,5000,15)
    steep_span = TransmissionSpan('T_steep','L','steep',GeoPoint(37.0,-122.0,50),GeoPoint(37.1,-122.1,500),10,115,5000,15)
    assert engine._terrain_multiplier(flat_span) < engine._terrain_multiplier(steep_span)
    print(f'   ✓ Terrain: flat={engine._terrain_multiplier(flat_span):.2f} steep={engine._terrain_multiplier(steep_span):.2f}')

    print()
    print('[VEG 4/5] Transmission line seed data...')
    from backend.vegetation.transmission_lines import (
        get_all_spans, get_spans_by_zone, get_spans_by_line, TRANSMISSION_LINES
    )
    all_spans = get_all_spans()
    assert len(all_spans) > 0
    total_expected = sum(L['n_spans'] for L in TRANSMISSION_LINES)
    assert len(all_spans) == total_expected
    print(f'   ✓ {len(all_spans)} spans across {len(TRANSMISSION_LINES)} transmission lines')

    # Zone filtering
    north = get_spans_by_zone('North Zone')
    central = get_spans_by_zone('Central Zone')
    south = get_spans_by_zone('South Zone')
    assert len(north) + len(central) + len(south) == len(all_spans)
    print(f'   ✓ Zone split: North={len(north)} Central={len(central)} South={len(south)}')

    # Span geometry sanity
    for s in all_spans:
        assert -90 <= s.start.lat <= 90
        assert -180 <= s.start.lon <= 180
        assert s.length_m > 0
        assert s.conductor_height_m > 0
        assert s.voltage_kv in (115, 230, 500)
    print(f'   ✓ All span geometries valid')

    print()
    print('[VEG 5/5] Batch scoring + summary stats...')
    from backend.vegetation.risk_engine import VegetationRiskBatchScorer

    async def test_batch():
        scorer = VegetationRiskBatchScorer()
        # Score a small subset for speed
        test_spans = all_spans[:6]
        scores = await scorer.score_all_spans(test_spans, include_history=False)
        assert len(scores) == len(test_spans)
        # Should be sorted descending by risk
        for i in range(len(scores)-1):
            assert scores[i].overall_risk_score >= scores[i+1].overall_risk_score
        stats = scorer.summary_stats(scores)
        assert stats['total_spans'] == len(test_spans)
        assert stats['critical'] + stats['high'] + stats['medium'] + stats['low'] == len(test_spans)
        assert 0 <= stats['avg_risk_score'] <= 100
        return scores, stats

    scores, stats = asyncio.run(test_batch())
    print(f'   ✓ Batch scored {stats["total_spans"]} spans')
    print(f'   ✓ Risk breakdown: critical={stats["critical"]} high={stats["high"]} medium={stats["medium"]} low={stats["low"]}')
    print(f'   ✓ Avg risk: {stats["avg_risk_score"]} | NERC violations: {stats["nerc_violations"]}')
    if stats["immediate_work_orders"] > 0:
        print(f'   ✓ {stats["immediate_work_orders"]} immediate work orders generated')

    print()
    print('  ✓ ALL VEGETATION TESTS PASSED')


if __name__ == '__main__':
    run_vegetation_tests()

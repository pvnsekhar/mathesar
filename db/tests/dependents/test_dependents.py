import pytest
from sqlalchemy import MetaData, select, Index
from sqlalchemy_utils import create_view
from db.constraints.operations.create import add_constraint_via_sql_alchemy
from db.constraints.base import ForeignKeyConstraint
from db.dependents.dependents_utils import get_dependents_graph
from db.constraints.operations.select import get_constraint_oid_by_name_and_table_oid
from db.columns.operations.create import create_column
from db.columns.operations.select import get_column_attnum_from_name
from db.types.base import PostgresType
from db.metadata import get_empty_metadata


def _get_object_dependents(dependents_graph, object_oid):
    return list(filter(lambda x: x['parent_obj']['objid'] == object_oid, dependents_graph))


def _get_object_dependents_oids(dependents_graph, object_oid):
    return [dependent['obj']['objid'] for dependent in _get_object_dependents(dependents_graph, object_oid)]


def _get_object_dependents_by_name(dependents_graph, object_oid, name):
    return [dependent['obj'] for dependent in _get_object_dependents(dependents_graph, object_oid) if dependent['obj']['name'] == name]


def test_correct_dependents_amount_and_level(engine, library_tables_oids):
    publishers_dependents_graph = get_dependents_graph(library_tables_oids['Publishers'], engine, [])

    publishers_dependents = _get_object_dependents(publishers_dependents_graph, library_tables_oids['Publishers'])

    assert len(publishers_dependents) == 3
    assert all(
        [
            r['level'] == 1
            for r in publishers_dependents
        ]
    )


def test_response_format(engine, library_tables_oids):
    publishers_dependents_graph = get_dependents_graph(library_tables_oids['Publishers'], engine, [])

    dependent_expected_attrs = ['obj', 'parent_obj', 'level']
    obj_expected_attrs = ['objid', 'type']
    assert all(
        [
            all(attr in dependent for attr in dependent_expected_attrs)
            for dependent in publishers_dependents_graph
        ]
    )
    assert all(
        [
            all(attr in dependent['obj'] for attr in obj_expected_attrs)
            for dependent in publishers_dependents_graph
        ]
    )
    assert all(
        [
            all(attr in dependent['parent_obj'] for attr in obj_expected_attrs)
            for dependent in publishers_dependents_graph
        ]
    )


def test_constrains_as_dependents(engine, library_tables_oids, library_db_tables):
    items_oid = library_tables_oids['Items']
    items_dependents_graph = get_dependents_graph(items_oid, engine, [])
    items_dependents_oids = _get_object_dependents_oids(items_dependents_graph, items_oid)

    items_constraint_oids = [
        get_constraint_oid_by_name_and_table_oid(constraint.name, items_oid, engine)
        for constraint in library_db_tables['Items'].constraints]

    checkouts_items_fk_oid = get_constraint_oid_by_name_and_table_oid(
        'Checkouts_Item id_fkey', library_tables_oids['Checkouts'], engine
    )

    assert all(
        [
            oid in items_dependents_oids
            for oid in items_constraint_oids + [checkouts_items_fk_oid]
        ]
    )


# if a table contains a foreign key referencing itself, it shouldn't be treated as a dependent
def test_self_reference(engine_with_schema, library_tables_oids):
    engine, schema = engine_with_schema

    publishers_oid = library_tables_oids['Publishers']

    # remove when library_without_checkouts.sql is updated and includes self-reference case
    fk_column_attnum = create_column(engine, publishers_oid, {'name': 'Parent Publisher', 'type': PostgresType.INTEGER.id})[0]
    pk_column_attnum = get_column_attnum_from_name(publishers_oid, 'id', engine, metadata=get_empty_metadata())
    fk_constraint = ForeignKeyConstraint('Publishers_Publisher_fkey', publishers_oid, [fk_column_attnum], publishers_oid, [pk_column_attnum], {})
    add_constraint_via_sql_alchemy(fk_constraint, engine)

    publishers_oid = library_tables_oids['Publishers']
    publishers_dependents_graph = get_dependents_graph(publishers_oid, engine, [])

    publishers_dependents_oids = _get_object_dependents_oids(publishers_dependents_graph, publishers_oid)
    assert publishers_oid not in publishers_dependents_oids


# if two tables depend on each other, we should return dependence only for the topmost object in the graph
# excluding the possibility of circulal reference
def test_circular_reference(engine_with_schema, library_tables_oids):
    engine, schema = engine_with_schema

    publishers_oid = library_tables_oids['Publishers']
    publications_oid = library_tables_oids['Publications']

    # remove when library_without_checkouts.sql is updated and includes circular reference case
    fk_column_attnum = create_column(engine, publishers_oid, {'name': 'Top Publication', 'type': PostgresType.INTEGER.id})[0]
    publications_pk_column_attnum = get_column_attnum_from_name(publications_oid, 'id', engine, metadata=get_empty_metadata())
    fk_constraint = ForeignKeyConstraint('Publishers_Publications_fkey', publishers_oid, [fk_column_attnum], publications_oid, [publications_pk_column_attnum], {})
    add_constraint_via_sql_alchemy(fk_constraint, engine)

    publishers_dependents_graph = get_dependents_graph(publishers_oid, engine, [])
    publications_dependents_oids = _get_object_dependents_oids(publishers_dependents_graph, publications_oid)

    assert publishers_oid not in publications_dependents_oids


def test_dependents_graph_max_level(engine_with_schema, library_db_tables, library_tables_oids):
    engine, schema = engine_with_schema
    metadata = MetaData(schema=schema, bind=engine)
    source = library_db_tables['Checkouts'].c.id

    for i in range(15):
        view_name = str(i)
        source = create_view(view_name, select(source), metadata)
    metadata.create_all(engine)

    checkouts_dependents_graph = get_dependents_graph(library_tables_oids['Checkouts'], engine, [])

    # by default, dependents graph max level is 10
    dependents_by_level = sorted(checkouts_dependents_graph, key=lambda x: x['level'])
    assert dependents_by_level[0]['level'] == 1
    assert dependents_by_level[-1]['level'] == 10


def test_column_dependents(engine, library_tables_oids):
    publications_oid = library_tables_oids['Publications']
    items_oid = library_tables_oids['Items']
    publications_id_column_attnum = get_column_attnum_from_name(publications_oid, 'id', engine, metadata=get_empty_metadata())
    publications_id_column_dependents_graph = get_dependents_graph(publications_oid, engine, [], publications_id_column_attnum)

    publications_pk_oid = get_constraint_oid_by_name_and_table_oid('Publications_pkey', publications_oid, engine)
    items_publications_fk_oid = get_constraint_oid_by_name_and_table_oid('Items_Publications_id_fkey', items_oid, engine)

    publications_dependents = _get_object_dependents(publications_id_column_dependents_graph, publications_oid)
    publications_dependent_oids = _get_object_dependents_oids(publications_id_column_dependents_graph, publications_oid)
    assert all(
        [
            r['parent_obj']['objsubid'] == 1
            for r in publications_dependents
        ]
    )
    assert all(
        [
            oid in publications_dependent_oids
            for oid in [publications_pk_oid, items_publications_fk_oid]
        ]
    )


def test_views_as_dependents(engine_with_schema, library_db_tables, library_tables_oids):
    engine, schema = engine_with_schema
    metadata = MetaData(schema=schema, bind=engine)

    publications = library_db_tables['Publications']
    new_publications_view = select(publications).where(publications.c['Publication Year'] >= 2000)
    view_name = 'new_publications'
    create_view(view_name, new_publications_view, metadata)
    metadata.create_all(engine)

    publications_oid = library_tables_oids['Publications']
    publications_dependents_graph = get_dependents_graph(publications_oid, engine, [])
    publications_view_dependent = _get_object_dependents_by_name(publications_dependents_graph, publications_oid, view_name)[0]

    assert publications_view_dependent['name'] == view_name


def test_indexes_as_dependents(engine, library_db_tables, library_tables_oids):
    index_name = 'index'
    index = Index(index_name, library_db_tables['Publishers'].c.id)
    index.create(engine)

    publishers_dependents_graph = get_dependents_graph(library_tables_oids['Publishers'], engine, [])
    publishers_index_dependent = _get_object_dependents_by_name(publishers_dependents_graph, library_tables_oids['Publishers'], index_name)[0]

    assert publishers_index_dependent['name'] == index_name


types = [
    ['table'],
    ['table constraint'],
    ['table', 'table constraint'],
]


@pytest.mark.parametrize("exclude_types", types)
def test_filter(engine, library_tables_oids, exclude_types):
    publishers_oid = library_tables_oids['Publishers']

    publishers_dependents_graph = get_dependents_graph(publishers_oid, engine, exclude_types)
    dependents_types = [dependent['obj']['type'] for dependent in publishers_dependents_graph]

    assert all(
        [
            type not in dependents_types for type in exclude_types
        ]
    )


def test_sequences_as_dependents(engine, library_tables_oids):
    publishers_oid = library_tables_oids['Publishers']
    publishers_sequence_name = '"Publishers_id_seq"'
    publishers_dependents_graph = get_dependents_graph(publishers_oid, engine, [])
    publishers_sequence_dependent = _get_object_dependents_by_name(publishers_dependents_graph, publishers_oid, publishers_sequence_name)[0]

    assert publishers_sequence_dependent['name'] == publishers_sequence_name

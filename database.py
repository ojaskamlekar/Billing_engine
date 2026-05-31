from sqlalchemy import create_engine

DATABASE_URL = "postgresql+psycopg2://postgres:12345678@localhost:5433/billing_engine"

engine = create_engine(DATABASE_URL)
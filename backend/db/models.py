import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, ForeignKey, JSON, Enum as SAEnum
from sqlalchemy.orm import relationship
from backend.db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Novel(Base):
    __tablename__ = "novels"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(255), nullable=False)
    source_lang = Column(String(10), nullable=False, default="zh")
    target_lang = Column(String(10), nullable=False, default="en")
    genre = Column(String(100), default="")
    summary = Column(Text, default="")
    instructions = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapters = relationship("Chapter", back_populates="novel", cascade="all, delete-orphan")
    characters = relationship("Character", back_populates="novel", cascade="all, delete-orphan")
    glossary_terms = relationship("GlossaryTerm", back_populates="novel", cascade="all, delete-orphan")
    plot_arcs = relationship("PlotArc", back_populates="novel", cascade="all, delete-orphan")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(String, primary_key=True, default=generate_uuid)
    novel_id = Column(String, ForeignKey("novels.id"), nullable=False)
    number = Column(Integer, nullable=False)
    title = Column(String(255), default="")
    source_text = Column(Text, nullable=False)
    translated = Column(Boolean, default=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    novel = relationship("Novel", back_populates="chapters")
    segments = relationship("Segment", back_populates="chapter", cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "segments"

    id = Column(String, primary_key=True, default=generate_uuid)
    chapter_id = Column(String, ForeignKey("chapters.id"), nullable=False)
    segment_number = Column(Integer, nullable=False)
    source_text = Column(Text, nullable=False)
    translation = Column(Text, default="")
    status = Column(String(20), default="untouched")
    has_qa = Column(Boolean, default=False)

    chapter = relationship("Chapter", back_populates="segments")


class Character(Base):
    __tablename__ = "characters"

    id = Column(String, primary_key=True, default=generate_uuid)
    novel_id = Column(String, ForeignKey("novels.id"), nullable=False)
    name = Column(String(255), nullable=False)
    name_variants = Column(JSON, default=list)
    gender = Column(String(20), default="Unknown")
    role = Column(String(50), default="Minor")
    first_appearance = Column(Integer, default=1)
    traits = Column(JSON, default=dict)
    relationships = Column(JSON, default=list)
    status = Column(String(20), default="Alive")
    state_summary = Column(Text, default="")

    novel = relationship("Novel", back_populates="characters")


class GlossaryTerm(Base):
    __tablename__ = "glossary_terms"

    id = Column(String, primary_key=True, default=generate_uuid)
    novel_id = Column(String, ForeignKey("novels.id"), nullable=False)
    source_term = Column(String(255), nullable=False)
    target_term = Column(String(255), nullable=False)
    category = Column(String(50), default="Term")
    context_note = Column(Text, default="")
    is_name = Column(Boolean, default=False)
    gender_hint = Column(String(20), default="")

    novel = relationship("Novel", back_populates="glossary_terms")


class PlotArc(Base):
    __tablename__ = "plot_arcs"

    id = Column(String, primary_key=True, default=generate_uuid)
    novel_id = Column(String, ForeignKey("novels.id"), nullable=False)
    arc_name = Column(String(255), nullable=False)
    chapter_start = Column(Integer, nullable=False)
    chapter_end = Column(Integer)
    summary = Column(Text, default="")
    active_issues = Column(JSON, default=list)

    novel = relationship("Novel", back_populates="plot_arcs")


class TMSegment(Base):
    __tablename__ = "tm_segments"

    id = Column(String, primary_key=True, default=generate_uuid)
    novel_id = Column(String, ForeignKey("novels.id"), nullable=False)
    source_text = Column(Text, nullable=False)
    target_text = Column(Text, nullable=False)
    chapter_id = Column(String, ForeignKey("chapters.id"))

    novel = relationship("Novel")
    chapter = relationship("Chapter")


class QAItem(Base):
    __tablename__ = "qa_queue"

    id = Column(String, primary_key=True, default=generate_uuid)
    segment_id = Column(String, ForeignKey("segments.id"), nullable=False)
    question_type = Column(String(50), nullable=False)
    question = Column(Text, nullable=False)
    context_snippet = Column(Text, default="")
    suggestions = Column(JSON, default=list)
    answer = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)

    segment = relationship("Segment")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")

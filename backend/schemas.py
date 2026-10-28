"""
MediPulse FastAPI Request & Response Pydantic Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PatientInput(BaseModel):
    age: str = Field(default="[60-70)", description="Age bracket, e.g., '[60-70)'")
    gender: str = Field(default="Female", description="'Female', 'Male', or 'Unknown'")
    race: str = Field(default="Caucasian", description="'Caucasian', 'AfricanAmerican', 'Hispanic', etc.")
    time_in_hospital: int = Field(default=4, ge=1, le=14, description="Length of stay in days (1-14)")
    num_lab_procedures: int = Field(default=45, ge=0, le=150, description="Number of lab tests performed")
    num_procedures: int = Field(default=1, ge=0, le=10, description="Number of non-lab procedures performed")
    num_medications: int = Field(default=14, ge=1, le=100, description="Distinct medications administered")
    number_outpatient: int = Field(default=0, ge=0, le=50, description="Outpatient visits in prior year")
    number_emergency: int = Field(default=0, ge=0, le=50, description="Emergency visits in prior year")
    number_inpatient: int = Field(default=0, ge=0, le=50, description="Inpatient admissions in prior year")
    number_diagnoses: int = Field(default=7, ge=1, le=20, description="Number of diagnoses entered on encounter")
    diag_1_category: str = Field(default="Circulatory", description="Clinical grouping of primary diagnosis")
    admission_type_desc: str = Field(default="Emergency", description="Admission mode: Emergency, Urgent, Elective, etc.")
    discharge_disposition_desc: str = Field(default="Discharged to home", description="Discharge destination")
    A1Cresult: str = Field(default="None", description="HbA1c test result: 'None', 'Norm', '>7', '>8'")
    max_glu_serum: str = Field(default="None", description="Glucose serum test result: 'None', 'Norm', '>200', '>300'")
    change: str = Field(default="No", description="Medication change occurred: 'Ch' or 'No'")
    diabetesMed: str = Field(default="Yes", description="Prescribed diabetes medication: 'Yes' or 'No'")
    insulin: str = Field(default="Steady", description="Insulin regimen: 'No', 'Steady', 'Up', 'Down'")


class ContributingFactor(BaseModel):
    feature: str
    impact: float
    signed_impact: float
    direction: str
    description: str


class PredictionResponse(BaseModel):
    risk_probability: float
    risk_percentage: float
    risk_level: str
    operational_threshold: float
    top_factors: List[ContributingFactor]
    recommendations: List[str]


class HealthResponse(BaseModel):
    status: str
    version: str
    models_loaded: bool

import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const SIGNUP = gql`
  mutation Signup($email: String!, $password: String!) {
    signup(email: $email, password: $password) {
      token
      user {
        id
        email
      }
    }
  }
`;

const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user {
        id
        email
      }
    }
  }
`;

const GET_PLANS = gql`
  query GetPlans {
    getPlans {
      id
      name
      niche
      platform
      goal
      tone
      createdAt
      updatedAt
    }
  }
`;

const GET_PLAN = gql`
  query GetPlan($id: ID!) {
    getPlan(id: $id) {
      id
      name
      niche
      platform
      goal
      tone
      createdAt
      updatedAt
      posts {
        id
        day
        date
        format
        caption
        hashtags
        status
        scheduledAt
      }
    }
  }
`;

const CREATE_PLAN = gql`
  mutation CreatePlan($input: CreatePlanInput!) {
    createPlan(input: $input) {
      id
      name
      niche
      platform
      goal
      tone
    }
  }
`;

const GENERATE_CALENDAR = gql`
  mutation GenerateCalendar($planId: ID!) {
    generateCalendar(planId: $planId) {
      id
      name
      posts {
        id
        day
        date
        format
        caption
        hashtags
        status
        scheduledAt
      }
    }
  }
`;

const UPDATE_POST = gql`
  mutation UpdatePost($input: UpdatePostInput!) {
    updatePost(input: $input) {
      id
      caption
      hashtags
      status
      scheduledAt
    }
  }
`;

const DELETE_PLAN = gql`
  mutation DeletePlan($id: ID!) {
    deletePlan(id: $id)
  }
`;

const EXPORT_PLAN = gql`
  mutation ExportPlan($id: ID!, $format: String!) {
    exportPlan(id: $id, format: $format) {
      data
      format
    }
  }
`;

@Injectable({
  providedIn: 'root'
})
export class GraphqlService {
  constructor(private apollo: Apollo) {}

  signup(email: string, password: string): Observable<any> {
    return this.apollo.mutate({
      mutation: SIGNUP,
      variables: { email, password }
    }).pipe(map((result: any) => result.data.signup));
  }

  login(email: string, password: string): Observable<any> {
    return this.apollo.mutate({
      mutation: LOGIN,
      variables: { email, password }
    }).pipe(map((result: any) => result.data.login));
  }

  getPlans(): Observable<any[]> {
    return this.apollo.query({
      query: GET_PLANS,
      fetchPolicy: 'network-only'
    }).pipe(map((result: any) => result.data.getPlans));
  }

  getPlan(id: string): Observable<any> {
    return this.apollo.query({
      query: GET_PLAN,
      variables: { id },
      fetchPolicy: 'network-only'
    }).pipe(map((result: any) => result.data.getPlan));
  }

  createPlan(input: any): Observable<any> {
    return this.apollo.mutate({
      mutation: CREATE_PLAN,
      variables: { input }
    }).pipe(map((result: any) => result.data.createPlan));
  }

  generateCalendar(planId: string): Observable<any> {
    return this.apollo.mutate({
      mutation: GENERATE_CALENDAR,
      variables: { planId }
    }).pipe(map((result: any) => result.data.generateCalendar));
  }

  updatePost(input: any): Observable<any> {
    return this.apollo.mutate({
      mutation: UPDATE_POST,
      variables: { input }
    }).pipe(map((result: any) => result.data.updatePost));
  }

  deletePlan(id: string): Observable<boolean> {
    return this.apollo.mutate({
      mutation: DELETE_PLAN,
      variables: { id }
    }).pipe(map((result: any) => result.data.deletePlan));
  }

  exportPlan(id: string, format: string): Observable<any> {
    return this.apollo.mutate({
      mutation: EXPORT_PLAN,
      variables: { id, format }
    }).pipe(map((result: any) => result.data.exportPlan));
  }
}